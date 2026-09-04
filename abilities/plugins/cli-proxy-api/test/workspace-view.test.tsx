import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

    const card = (await screen.findByText("user@example.com")).closest("article") as HTMLElement;
    expect(within(card).getByText("console.successCount:605")).toBeTruthy();
    expect(within(card).getByText("console.failedCount:4")).toBeTruthy();
    // Size and timestamp come straight from the credential record.
    expect(within(card).getByText(/588 B/u)).toBeTruthy();
    // A fixed 20-window axis keeps the strips aligned across cards.
    expect(within(card).getByRole("img", { name: "console.usageChart" }).childElementCount).toBe(20);

    // A disabled credential reads as disabled and its switch is off.
    const second = (screen.getByText("second@example.com")).closest("article") as HTMLElement;
    expect(within(second).getByText("console.disabled")).toBeTruthy();
    expect(within(second).getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("keeps model lists out of the grid and behind a dialog", async () => {
    const f = fixture();
    withAccounts(f);
    render(<ProxyWorkspaceView context={f.context} />);

    const card = (await screen.findByText("user@example.com")).closest("article") as HTMLElement;
    // The grid itself never lists models.
    expect(screen.queryByText("gemini-test")).toBeNull();

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

    const card = (await screen.findByText("user@example.com")).closest("article") as HTMLElement;
    fireEvent.click(within(card).getByRole("switch"));
    await waitFor(() => expect(f.handle).toHaveBeenCalledWith(expect.objectContaining({
      path: "/v0/management/auth-files/status",
      method: "PATCH",
      body: { name: "gemini-user.json", disabled: true }
    })));
  });

  it("takes over the host header and clears it on unmount", async () => {
    const f = fixture();
    const { unmount } = render(<ProxyWorkspaceView context={f.context} />);
    await waitFor(() => expect(f.setWorkspaceViewHeader).toHaveBeenCalled());
    expect(f.setWorkspaceViewHeader.mock.calls[0][0]).toBe("console");
    unmount();
    expect(f.setWorkspaceViewHeader).toHaveBeenLastCalledWith("console", null);
  });
});
