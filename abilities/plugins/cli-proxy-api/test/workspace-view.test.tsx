import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { ProxyWorkspaceView, formatTokens } from "../src/workspace-view";
import { fixture } from "./helpers";

vi.mock("@vetta-org/plugin-sdk", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values?.count === undefined ? key : `${key}:${values.count}`;
  return { useTranslation: () => ({ t }) };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/** Two credentials with the counters the CLIProxyAPI panel renders per card. */
function withAccounts(f: ReturnType<typeof fixture>): void {
  const original = f.handle.getMockImplementation();
  f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
    if (request.path === "/v0/management/auth-files" && request.method === undefined) {
      return { files: [
        {
          auth_index: "gem-1",
          name: "gemini-user.json",
          provider: "gemini-cli",
          email: "user@example.com",
          status: "ready",
          disabled: false,
          size: 588,
          modtime: "2026-09-04T02:42:55Z",
          success: 605,
          failed: 4,
          recent_requests: [
            { time: "12:00-12:10", success: 600, failed: 0 },
            { time: "12:10-12:20", success: 5, failed: 4 }
          ]
        },
        {
          auth_index: "kimi-1",
          name: "kimi-user.json",
          provider: "kimi",
          email: "second@example.com",
          disabled: true,
          success: 0,
          failed: 0
        }
      ] };
    }
    if (request.path.startsWith("/v0/management/auth-files/models")) {
      return { models: [{ id: "gemini-test", display_name: "Gemini Test" }] };
    }
    return original!(request);
  });
}


/** The account name labels both its card and its picker group; this wants the card. */
async function cardFor(name: string): Promise<HTMLElement> {
  await screen.findAllByText(name);
  const card = screen.getAllByText(name)
    .map((element) => element.closest("article"))
    .find((element): element is HTMLElement => element !== null);
  if (!card) throw new Error(`No credential card for ${name}`);
  return card;
}

describe("CLIProxyAPI console", () => {
  it("quotes token limits in the base the vendor published them in", () => {
    // Decimal limits stay decimal; binary limits stay binary. One divisor cannot do both.
    expect(formatTokens(200_000)).toBe("200K");
    expect(formatTokens(128_000)).toBe("128K");
    expect(formatTokens(65_536)).toBe("64K");
    expect(formatTokens(262_144)).toBe("256K");
    expect(formatTokens(1_048_576)).toBe("1M");
    expect(formatTokens(1_050_000)).toBe("1.05M");
    expect(formatTokens(undefined)).toBeUndefined();
  });

  it("lays every credential out as its own card with the gateway's own counters", async () => {
    const f = fixture();
    withAccounts(f);
    render(<ProxyWorkspaceView context={f.context} />);

    const card = await cardFor("user@example.com");
    expect(within(card).getByText("console.successCount:605")).toBeTruthy();
    expect(within(card).getByText("console.failedCount:4")).toBeTruthy();
    // Size and timestamp come straight from the credential record.
    expect(within(card).getByText(/588 B/u)).toBeTruthy();
    // A fixed 20-window axis keeps the strips aligned across cards.
    expect(within(card).getByRole("img", { name: "console.usageChart" }).childElementCount).toBe(20);

    // A disabled credential reads as disabled and its switch is off. The name also
    // labels its group in the picker, so this looks specifically at the card.
    const second = await cardFor("second@example.com");
    expect(within(second).getByText("console.disabled")).toBeTruthy();
    expect(within(second).getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("keeps model lists out of the grid and behind a dialog", async () => {
    const f = fixture();
    withAccounts(f);
    render(<ProxyWorkspaceView context={f.context} />);

    const card = await cardFor("user@example.com");
    // A credential card stays about health; its models live behind the button.
    expect(within(card).queryByText("gemini-test")).toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: "console.models" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("gemini-test");
    expect(f.handle).toHaveBeenCalledWith(expect.objectContaining({
      path: "/v0/management/auth-files/models?name=gemini-user.json"
    }));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("switches a credential through the gateway rather than only in the UI", async () => {
    const f = fixture();
    withAccounts(f);
    render(<ProxyWorkspaceView context={f.context} />);

    const card = await cardFor("user@example.com");
    fireEvent.click(within(card).getByRole("switch"));
    await waitFor(() => expect(f.handle).toHaveBeenCalledWith(expect.objectContaining({
      path: "/v0/management/auth-files/status",
      method: "PATCH",
      body: { name: "gemini-user.json", disabled: true }
    })));
  });


  it("offers every provider for authorization and drives the flow from here", async () => {
    const f = fixture();
    render(<ProxyWorkspaceView context={f.context} />);

    fireEvent.click(await screen.findByRole("button", { name: "console.addAccount" }));
    const picker = await screen.findByRole("dialog");
    const icons = Array.from(picker.querySelectorAll("[data-provider-icon]"), (el) => el.getAttribute("data-provider-icon"));
    expect(icons).toEqual(["gemini-cli", "codex", "claude", "antigravity", "kimi", "xai"]);

    expect(f.openExternal).not.toHaveBeenCalled();
    fireEvent.click(within(picker).getByRole("button", { name: "provider.kimi setup.deviceFlow" }));
    await screen.findByText("ABCD-EFGH");
    expect(f.openExternal).toHaveBeenCalledWith("https://accounts.example.com/oauth");

    f.handle.mockImplementation(async (request: { path: string }) =>
      request.path.includes("get-auth-status") ? { status: "ok" }
        : request.path === "/v1/models" ? { data: [{ id: "codex-test", owned_by: "codex" }] }
        : { files: [] });
    await screen.findByText("setup.oauthSuccess", {}, { timeout: 2500 });
    await waitFor(() => expect(f.upsertProvider).toHaveBeenCalledWith("responses", expect.objectContaining({ api: "openai-responses" })));
  });

  it("does not accept an in-flight authorization that was cancelled", async () => {
    const f = fixture();
    render(<ProxyWorkspaceView context={f.context} />);
    fireEvent.click(await screen.findByRole("button", { name: "console.addAccount" }));
    fireEvent.click(await screen.findByRole("button", { name: "provider.codex setup.browserFlow" }));
    await screen.findByText("setup.oauthWaiting");

    let resolvePoll!: (value: unknown) => void;
    f.handle.mockImplementation(async (request: { path: string }) =>
      request.path.includes("get-auth-status") ? await new Promise((resolve) => { resolvePoll = resolve; }) : { status: "ok" });
    await waitFor(() => expect(resolvePoll).toBeTypeOf("function"), { timeout: 2500 });
    fireEvent.click(screen.getByRole("button", { name: "setup.cancel" }));
    await act(async () => { resolvePoll({ status: "ok" }); });

    expect(screen.queryByText("setup.oauthSuccess")).toBeNull();
    expect(f.upsertProvider).not.toHaveBeenCalled();
    expect(f.handle).toHaveBeenCalledWith(expect.objectContaining({
      method: "DELETE", path: "/v0/management/oauth-session?state=state-1"
    }));
  });

  it("removes a credential only after the removal is confirmed", async () => {
    const f = fixture();
    withAccounts(f);
    render(<ProxyWorkspaceView context={f.context} />);

    const card = await cardFor("user@example.com");
    fireEvent.click(within(card).getByRole("button", { name: "setup.removeAccount user@example.com" }));
    expect(within(card).getByText("setup.removeAccountConfirm")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "setup.confirmRemove" }));

    await waitFor(() => expect(f.handle).toHaveBeenCalledWith(expect.objectContaining({
      method: "DELETE", path: "/v0/management/auth-files?name=gemini-user.json"
    })));
  });

  it("offers a full app reload so freshly synced models reach the picker", async () => {
    const f = fixture();
    render(<ProxyWorkspaceView context={f.context} />);
    // The header only carries the running-service actions once the service is up.
    await screen.findByText("setup.serviceReady");
    await waitFor(() => {
      const header = f.setWorkspaceViewHeader.mock.calls.at(-1)?.[1] as { right: ReactElement } | null;
      expect(header).toBeTruthy();
      cleanup();
      render(header!.right);
      // The gateway can publish a provider without the running renderer noticing it.
      expect(screen.getByRole("button", { name: "console.reloadApp" })).toBeTruthy();
    });
  });


  it("says up front that synced models need an app reload", async () => {
    const f = fixture();
    render(<ProxyWorkspaceView context={f.context} />);

    // The gateway syncs by itself when the service comes up, so the gap between
    // "synced" and "visible in the picker" has to be stated without being asked.
    await screen.findByText("console.reloadNotice");
  });


  it("publishes exactly the ticked models and remembers the choice", async () => {
    const f = fixture();
    withAccounts(f);
    render(<ProxyWorkspaceView context={f.context} />);

    // Nothing chosen yet means the gateway's previous behaviour: publish everything.
    // The group renders as soon as the credential is known; its models arrive after.
    const group = await screen.findByRole("region", { name: "user@example.com" });
    fireEvent.click(await within(group).findByRole("checkbox", { name: "gemini-test" }));

    await waitFor(() => expect((screen.getByRole("button", { name: "console.apply" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "console.apply" }));
    const confirm = await screen.findByRole("dialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "console.applyAndReload" }));

    // The applied set is the whole truth: an unticked model leaves the picker.
    await waitFor(() => expect(f.writeJson).toHaveBeenCalledWith(
      "published-models",
      { schemaVersion: 1, models: [] },
    ));
    await waitFor(() => expect(f.removeProvider).toHaveBeenCalledWith("google"));
  });

  it("applies nothing until the reload is confirmed", async () => {
    const f = fixture();
    withAccounts(f);
    render(<ProxyWorkspaceView context={f.context} />);

    await screen.findByRole("region", { name: "user@example.com" });
    await waitFor(() => expect((screen.getByRole("button", { name: "console.apply" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "console.apply" }));
    const confirm = await screen.findByRole("dialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "setup.cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(f.writeJson).not.toHaveBeenCalled();
    expect(f.reload).not.toHaveBeenCalled();
  });

  it("selects and clears every model at once", async () => {
    const f = fixture();
    withAccounts(f);
    render(<ProxyWorkspaceView context={f.context} />);

    const group = await screen.findByRole("region", { name: "user@example.com" });
    await within(group).findByRole("checkbox", { name: "gemini-test" });
    fireEvent.click(screen.getByRole("button", { name: "console.clearAll" }));
    expect((within(group).getByRole("checkbox", { name: "gemini-test" }) as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "console.selectAll" }));
    expect((within(group).getByRole("checkbox", { name: "gemini-test" }) as HTMLInputElement).checked).toBe(true);
  });


  it("keeps refreshing after authorization until the gateway reports the credential", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = fixture();
    // The gateway answers "ok" before the credential is registered: the first few
    // reads still show nothing, exactly as a real handshake does.
    let reads = 0;
    const original = f.handle.getMockImplementation()!;
    f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
      if (request.path === "/v0/management/auth-files" && request.method === undefined) {
        reads += 1;
        return reads < 3 ? { files: [] } : { files: [{
          auth_index: "kimi-1", name: "kimi-user.json", provider: "kimi",
          email: "late@example.com", disabled: false, success: 0, failed: 0
        }] };
      }
      if (request.path.includes("get-auth-status")) return { status: "ok" };
      return original(request);
    });

    render(<ProxyWorkspaceView context={f.context} />);
    fireEvent.click(await screen.findByRole("button", { name: "console.addAccount" }));
    fireEvent.click(await screen.findByRole("button", { name: "provider.kimi setup.deviceFlow" }));

    // A single refresh would have raced the gateway and shown nothing.
    await vi.waitFor(() => expect(screen.getAllByText("late@example.com").length).toBeGreaterThan(0), { timeout: 15000 });
    vi.useRealTimers();
  }, 20000);

  it("ticks the models a newly authorized credential brings in", async () => {
    const f = fixture();
    let accounts = [{
      auth_index: "gem-1", name: "gemini-user.json", provider: "gemini-cli",
      email: "user@example.com", disabled: false, success: 0, failed: 0
    }];
    const original = f.handle.getMockImplementation()!;
    f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
      if (request.path === "/v0/management/auth-files" && request.method === undefined) return { files: accounts };
      if (request.path.includes("name=gemini-user.json")) return { models: [{ id: "gemini-test" }] };
      if (request.path.includes("name=kimi-user.json")) return { models: [{ id: "kimi-new" }] };
      return original(request);
    });

    render(<ProxyWorkspaceView context={f.context} />);
    const first = await screen.findByRole("region", { name: "user@example.com" });
    // Clear-all is disabled while nothing is selected, so wait for the models.
    await within(first).findByRole("checkbox", { name: "gemini-test" });
    await waitFor(() => expect((screen.getByRole("button", { name: "console.clearAll" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "console.clearAll" }));

    // A second credential arrives; its models are a request, not a suggestion.
    accounts = [...accounts, {
      auth_index: "kimi-1", name: "kimi-user.json", provider: "kimi",
      email: "second@example.com", disabled: false, success: 0, failed: 0
    }];
    // Any credential action re-reads the gateway, which is how the new one arrives.
    fireEvent.click(screen.getByRole("button", { name: "console.resetQuota user@example.com" }));

    const second = await screen.findByRole("region", { name: "second@example.com" });
    await waitFor(() => expect((within(second).getByRole("checkbox", { name: "kimi-new" }) as HTMLInputElement).checked).toBe(true));
    // The models the user had just cleared stay cleared.
    expect((within(first).getByRole("checkbox", { name: "gemini-test" }) as HTMLInputElement).checked).toBe(false);
  });


  it("shows the provider's limits and its error sentence, not the raw envelope", async () => {
    const f = fixture();
    const original = f.handle.getMockImplementation()!;
    f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
      if (request.path === "/v0/management/auth-files" && request.method === undefined) {
        return { files: [{
          auth_index: "cx-1", name: "codex.json", provider: "codex", email: "user@example.com",
          disabled: false, unavailable: true, success: 0, failed: 1,
          status_message: JSON.stringify({ error: { type: "usage_limit_reached", message: "The usage limit has been reached" } }),
          id_token: { plan_type: "plus" },
          quota: { signals: {
            "X-Codex-Plan-Type": "plus",
            "X-Codex-Primary-Used-Percent": "100",
            "X-Codex-Primary-Window-Minutes": "300",
            "X-Codex-Secondary-Used-Percent": "32",
            "X-Codex-Secondary-Window-Minutes": "10080"
          } }
        }] };
      }
      return original(request);
    });

    render(<ProxyWorkspaceView context={f.context} />);
    const card = await cardFor("user@example.com");

    expect(within(card).getByText("console.plan")).toBeTruthy();
    // Remaining, not used: 100% consumed is 0% left.
    expect(within(card).getAllByText("console.remaining")).toHaveLength(2);
    expect(within(card).getByText("console.windowHours:5")).toBeTruthy();
    expect(within(card).getByText("console.windowWeekly")).toBeTruthy();
    // The JSON envelope stays out of the card.
    expect(within(card).getByText("The usage limit has been reached")).toBeTruthy();
    expect(within(card).queryByText(/usage_limit_reached/u)).toBeNull();
  });


  it("keeps a credential in the picker even when it answers with nothing", async () => {
    const f = fixture();
    const original = f.handle.getMockImplementation()!;
    f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
      if (request.path === "/v0/management/auth-files" && request.method === undefined) {
        return { files: [
          { auth_index: "gem-1", name: "gemini-user.json", provider: "gemini-cli", email: "first@example.com", disabled: false, success: 0, failed: 0 },
          { auth_index: "cx-1", name: "codex-user.json", provider: "codex", email: "second@example.com", disabled: false, unavailable: true, success: 0, failed: 0 }
        ] };
      }
      if (request.path.includes("name=gemini-user.json")) return { models: [{ id: "gemini-test" }] };
      // A rate-limited credential lists nothing; that is not a reason to hide it.
      if (request.path.includes("name=codex-user.json")) return { models: [] };
      return original(request);
    });

    render(<ProxyWorkspaceView context={f.context} />);

    await screen.findByRole("region", { name: "first@example.com" });
    const empty = screen.getByRole("region", { name: "second@example.com" });
    await within(empty).findByText("console.groupEmpty");
    // Its select-all box has nothing to select, so it must not look actionable.
    expect((within(empty).getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  });

  it("says which credential could not be read instead of dropping it", async () => {
    const f = fixture();
    const original = f.handle.getMockImplementation()!;
    f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
      if (request.path === "/v0/management/auth-files" && request.method === undefined) {
        return { files: [{ auth_index: "cx-1", name: "codex-user.json", provider: "codex", email: "broken@example.com", disabled: false, success: 0, failed: 0 }] };
      }
      if (request.path.includes("/auth-files/models")) throw new Error("upstream refused");
      return original(request);
    });

    render(<ProxyWorkspaceView context={f.context} />);

    const group = await screen.findByRole("region", { name: "broken@example.com" });
    expect((await within(group).findByRole("alert")).textContent).toContain("console.groupFailed");
  });


  it("retries a quota probe that failed and says why in the meantime", async () => {
    const f = fixture();
    let attempts = 0;
    const original = f.handle.getMockImplementation()!;
    f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
      if (request.path === "/v0/management/auth-files" && request.method === undefined) {
        return { files: [{ auth_index: "cx-1", name: "codex.json", provider: "codex", email: "user@example.com", disabled: false, success: 0, failed: 0 }] };
      }
      if (request.path === "/v0/management/api-call") {
        attempts += 1;
        // The gateway answers only once the credential is fully registered.
        if (attempts === 1) throw new Error("credential not ready");
        return { status_code: 200, body: { plan_type: "plus", rate_limit: { primary_window: { used_percent: 40, limit_window_seconds: 18000 } } } };
      }
      return original(request);
    });

    render(<ProxyWorkspaceView context={f.context} />);
    const card = await cardFor("user@example.com");
    // The reason is shown rather than a card that merely looks limit-free.
    expect((await within(card).findByRole("alert")).textContent).toContain("console.quotaFailed");

    fireEvent.click(within(card).getByRole("button", { name: "console.quotaRefresh" }));
    // A failed attempt must not be remembered as done, or nothing could retry.
    await within(card).findByText("console.remaining");
    expect(attempts).toBe(2);
  });


  it("keeps polling after authorization until the new credential's routes exist", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = fixture();
    let reads = 0;
    const original = f.handle.getMockImplementation()!;
    f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
      if (request.path === "/v0/management/auth-files" && request.method === undefined) {
        reads += 1;
        return reads < 2 ? { files: [] } : { files: [{
          auth_index: "kimi-1", name: "kimi-user.json", provider: "kimi", email: "late@example.com",
          disabled: false, success: 0, failed: 0
        }] };
      }
      // The credential is listed before the gateway finishes wiring its routes.
      if (request.path === "/v1/models") {
        return { data: reads < 4 ? [] : [{ id: "kimi-k2", owned_by: "kimi" }] };
      }
      if (request.path.includes("get-auth-status")) return { status: "ok" };
      if (request.path.includes("/auth-files/models")) return { models: reads < 4 ? [] : [{ id: "kimi-k2" }] };
      return original(request);
    });

    render(<ProxyWorkspaceView context={f.context} />);
    fireEvent.click(await screen.findByRole("button", { name: "console.addAccount" }));
    fireEvent.click(await screen.findByRole("button", { name: "provider.kimi setup.deviceFlow" }));

    // Stopping at "the credential appeared" would have settled on an empty list.
    await vi.waitFor(() => expect(screen.getAllByRole("checkbox", { name: "kimi-k2" }).length).toBeGreaterThan(0), { timeout: 20000 });
    vi.useRealTimers();
  }, 25000);


  it("publishes only the chosen models when the gateway syncs on its own", async () => {
    const f = fixture();
    // A credential the user had curated down to one model.
    f.readJson.mockImplementation(async () => ({ schemaVersion: 1, models: ["gemini-test"] }));
    withAccounts(f);
    render(<ProxyWorkspaceView context={f.context} />);
    await screen.findByRole("region", { name: "user@example.com" });

    // The post-authorization poll republishes; it must not quietly restore the rest.
    fireEvent.click(await screen.findByRole("button", { name: "console.addAccount" }));
    fireEvent.click(await screen.findByRole("button", { name: "provider.kimi setup.deviceFlow" }));
    f.handle.mockImplementation(async (request: { path: string }) =>
      request.path.includes("get-auth-status") ? { status: "ok" }
        : request.path === "/v1/models" ? { data: [{ id: "gemini-test", owned_by: "google" }, { id: "other", owned_by: "google" }] }
        : { files: [] });

    await waitFor(() => expect(f.upsertProvider).toHaveBeenCalledWith("google", expect.objectContaining({
      models: [expect.objectContaining({ id: "gemini-test" })]
    })), { timeout: 4000 });
  });


  it("keeps re-reading a credential whose routes are still being rebuilt", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = fixture();
    let reads = 0;
    const original = f.handle.getMockImplementation()!;
    f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
      if (request.path === "/v0/management/auth-files" && request.method === undefined) {
        return { files: [{ auth_index: "ag-1", name: "ag.json", provider: "antigravity", email: "user@example.com", disabled: false, success: 0, failed: 0 }] };
      }
      if (request.path.includes("/auth-files/models")) {
        reads += 1;
        // Restarting the gateway leaves the credential listed while its routes
        // are rebuilt: the first reads land in that window and see nothing.
        return { models: reads < 3 ? [] : [{ id: "gemini-3.8-flash" }] };
      }
      return original(request);
    });

    render(<ProxyWorkspaceView context={f.context} />);
    const group = await screen.findByRole("region", { name: "user@example.com" });
    // While retries remain it says it is waiting, not that the credential is empty.
    await within(group).findByText("console.groupSettling");
    await vi.waitFor(() => expect(within(group).getByRole("checkbox", { name: "gemini-3.8-flash" })).toBeTruthy(), { timeout: 20000 });
    vi.useRealTimers();
  }, 25000);


  it("does not re-tick models that only vanished while the gateway restarted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = fixture();
    let phase = "up";
    const original = f.handle.getMockImplementation()!;
    f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
      if (request.path === "/v0/management/auth-files" && request.method === undefined) {
        return { files: [{ auth_index: "ag-1", name: "ag.json", provider: "antigravity", email: "user@example.com", disabled: false, success: 0, failed: 0 }] };
      }
      if (request.path.includes("/auth-files/models")) {
        return { models: phase === "down" ? [] : [{ id: "gemini-a" }, { id: "gemini-b" }] };
      }
      return original(request);
    });

    render(<ProxyWorkspaceView context={f.context} />);
    const group = await screen.findByRole("region", { name: "user@example.com" });
    const b = await within(group).findByRole("checkbox", { name: "gemini-b" });
    await vi.waitFor(() => expect((b as HTMLInputElement).checked).toBe(true));
    fireEvent.click(b);
    expect((within(group).getByRole("checkbox", { name: "gemini-b" }) as HTMLInputElement).checked).toBe(false);

    // The gateway restarts: the credential stays listed but reports nothing yet.
    phase = "down";
    fireEvent.click(screen.getByRole("button", { name: "console.resetQuota user@example.com" }));
    await within(group).findByText("console.groupSettling");
    phase = "up";

    // Coming back is not the same as being new, so the deselection must survive.
    await vi.waitFor(() => expect(within(group).getByRole("checkbox", { name: "gemini-b" })).toBeTruthy(), { timeout: 20000 });
    await vi.waitFor(() => expect((within(group).getByRole("checkbox", { name: "gemini-a" }) as HTMLInputElement).checked).toBe(true));
    expect((within(group).getByRole("checkbox", { name: "gemini-b" }) as HTMLInputElement).checked).toBe(false);
    vi.useRealTimers();
  }, 25000);

  it("takes over the host header and clears it on unmount", async () => {
    const f = fixture();
    const { unmount } = render(<ProxyWorkspaceView context={f.context} />);
    await waitFor(() => expect(f.setWorkspaceViewHeader).toHaveBeenCalled());
    expect(f.setWorkspaceViewHeader.mock.calls[0][0]).toBe("console");
    unmount();
    expect(f.setWorkspaceViewHeader).toHaveBeenLastCalledWith("console", null);
  });
});
