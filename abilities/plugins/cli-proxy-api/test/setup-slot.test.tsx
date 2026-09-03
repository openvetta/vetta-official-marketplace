import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProxySetupSlot } from "../src/setup-slot";
import { fixture } from "./helpers";

vi.mock("@vetta-org/plugin-sdk", () => ({
  useTranslation: () => ({ t: (key: string, values?: { details?: string }) => values?.details ? `${key} ${values.details}` : key }),
}));
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("CLIProxyAPI setup", () => {
  it("groups authorization choices and renders a distinct icon for every supported provider", async () => {
    const f = fixture();
    const { container } = render(<ProxySetupSlot context={f.context} />);

    await screen.findByRole("region", { name: "setup.oauthTitle" });
    await waitFor(() => expect((screen.getByRole("button", { name: "setup.connect provider.gemini-cli" }) as HTMLButtonElement).disabled).toBe(false));

    const providerIcons = Array.from(container.querySelectorAll("[data-provider-icon]"), (element) => element.getAttribute("data-provider-icon"));
    expect(providerIcons).toEqual(["gemini-cli", "codex", "claude", "antigravity", "kimi", "xai"]);
  });

  it("requires an explicit click to start OAuth, shows device code and publishes models after success", async () => {
    const f = fixture();
    render(<ProxySetupSlot context={f.context} />);
    const button = await screen.findByRole("button", { name: "setup.connect provider.kimi" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(f.openExternal).not.toHaveBeenCalled();
    fireEvent.click(button);
    await screen.findByText("ABCD-EFGH");
    expect(f.openExternal).toHaveBeenCalledWith("https://accounts.example.com/oauth");
    f.handle.mockImplementation(async (request) => request.path.includes("get-auth-status") ? { status: "ok" } : request.path === "/v1/models" ? { data: [{ id: "codex-test", owned_by: "codex" }] } : { files: [] });
    await screen.findByText("setup.oauthSuccess", {}, { timeout: 2500 });
    await waitFor(() => expect(f.upsertProvider).toHaveBeenCalledWith("responses", expect.objectContaining({ api: "openai-responses" })));
  });
  it("does not accept an in-flight success response after cancellation", async () => {
    const f = fixture();
    render(<ProxySetupSlot context={f.context} />);
    const button = await screen.findByRole("button", { name: "setup.connect provider.codex" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    await screen.findByText("setup.oauthWaiting");
    let resolvePoll!: (value: unknown) => void;
    f.handle.mockImplementation(async (request) => request.path.includes("get-auth-status") ? await new Promise((resolve) => { resolvePoll = resolve; }) : { status: "ok" });
    await waitFor(() => expect(resolvePoll).toBeTypeOf("function"), { timeout: 2500 });
    fireEvent.click(screen.getByRole("button", { name: "setup.cancel" }));
    await act(async () => { resolvePoll({ status: "ok" }); });
    expect(screen.queryByText("setup.oauthSuccess")).toBeNull();
    expect(f.upsertProvider).not.toHaveBeenCalled();
    expect(f.handle).toHaveBeenCalledWith(expect.objectContaining({ method: "DELETE", path: "/v0/management/oauth-session?state=state-1" }));
  });

  it("shows a concise start failure without Electron IPC plumbing", async () => {
    const f = fixture();
    f.context.services.getStatus = vi.fn(async () => ({ ...f.ready, phase: "stopped", installed: false }));
    f.context.network.request = vi.fn(async () => {
      throw new Error("Error invoking remote method 'vetta:plugins:network:request': CapabilityError: Plugin network request failed (ERR_CONNECTION_RESET)");
    });

    render(<ProxySetupSlot context={f.context} />);
    fireEvent.click(await screen.findByRole("button", { name: "setup.start" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("setup.startFailed Plugin network request failed (ERR_CONNECTION_RESET)");
    expect(alert.textContent).not.toContain("Error invoking remote method");
    expect(alert.textContent).not.toContain("CapabilityError");
  });

  it("keeps connected accounts manageable and removes the old account before replacement", async () => {
    const f = fixture();
    let removed = false;
    f.handle.mockImplementation(async (request) => {
      if (request.path === "/v1/models") return { data: [{ id: "codex-test", owned_by: "codex" }] };
      if (request.method === "DELETE" && request.path.includes("/v0/management/auth-files?name=")) {
        removed = true;
        return { status: "ok" };
      }
      if (request.path === "/v0/management/auth-files") {
        return { files: removed ? [] : [{
          auth_index: "codex-old",
          name: "codex-old@example.com.json",
          provider: "codex",
          email: "old@example.com",
          status: "ready",
          disabled: false,
          unavailable: false,
          runtime_only: false,
          source: "file"
        }] };
      }
      return { status: "wait" };
    });

    render(<ProxySetupSlot context={f.context} />);

    await screen.findByText("old@example.com");
    expect(screen.getByRole("button", { name: "setup.addOrReplace provider.codex" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "setup.removeAccount old@example.com" }));
    expect(screen.getByText("setup.removeAccountConfirm")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "setup.confirmRemove old@example.com" }));

    await waitFor(() => expect(f.handle).toHaveBeenCalledWith(expect.objectContaining({
      method: "DELETE",
      path: "/v0/management/auth-files?name=codex-old%40example.com.json"
    })));
    await waitFor(() => expect(screen.queryByText("old@example.com")).toBeNull());
    expect(screen.getByRole("button", { name: "setup.connect provider.codex" })).toBeTruthy();
  });
});
