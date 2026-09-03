import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProxySetupSlot } from "../src/setup-slot";
import { fixture } from "./helpers";

vi.mock("@vetta-org/plugin-sdk", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("CLIProxyAPI setup", () => {
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
});
