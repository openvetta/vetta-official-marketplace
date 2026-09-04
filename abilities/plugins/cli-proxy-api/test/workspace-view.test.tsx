import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProxyWorkspaceView } from "../src/workspace-view";
import { fixture } from "./helpers";

vi.mock("@vetta-org/plugin-sdk", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/** An auth-files payload carrying the health counters the CLIProxyAPI panel shows. */
function withHealthyGeminiAccount(f: ReturnType<typeof fixture>): void {
  const original = f.handle.getMockImplementation();
  f.handle.mockImplementation(async (request: { path: string; method?: string }) => {
    if (request.path === "/v0/management/auth-files" && request.method === undefined) {
      return { files: [{
        auth_index: "gem-1",
        name: "gemini-user.json",
        provider: "gemini-cli",
        email: "user@example.com",
        status: "ready",
        disabled: false,
        success: 9,
        failed: 1,
        recent_requests: [
          { time: "12:00-12:10", success: 6, failed: 0 },
          { time: "12:10-12:20", success: 3, failed: 1 }
        ]
      }] };
    }
    return original!(request);
  });
}

describe("CLIProxyAPI workspace", () => {
  it("lists every channel with what it can route and marks models the gateway is not serving", async () => {
    const f = fixture();
    render(<ProxyWorkspaceView context={f.context} />);

    // The gemini channel is the only one the fixture catalog answers for.
    const supported = await screen.findByText("console.supportedModels");
    const channel = supported.closest("section");
    expect(channel).not.toBeNull();
    expect(within(channel as HTMLElement).getByText("gemini-test")).toBeTruthy();
    // Metadata read from the management catalog, not invented by the page.
    expect(within(channel as HTMLElement).getByText("console.context")).toBeTruthy();
    expect(within(channel as HTMLElement).getByText("console.reasoning")).toBeTruthy();
    expect(within(channel as HTMLElement).queryByText("console.notRouted")).toBeNull();

    // All six providers get a card whether or not they have a credential.
    const icons = Array.from(document.querySelectorAll("[data-provider-icon]"), (el) => el.getAttribute("data-provider-icon"));
    expect(icons).toEqual(["gemini-cli", "codex", "claude", "antigravity", "kimi", "xai"]);
  });

  it("surfaces per-channel request health from the gateway counters", async () => {
    const f = fixture();
    withHealthyGeminiAccount(f);
    render(<ProxyWorkspaceView context={f.context} />);

    await screen.findByText("user@example.com");
    expect(screen.getByText("console.channelRequests")).toBeTruthy();
    expect(screen.getByText("console.successRate")).toBeTruthy();
    // Two ten-minute windows were reported, so two bars are drawn.
    const chart = screen.getByRole("img", { name: "console.usageChart" });
    expect(chart.childElementCount).toBe(2);
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
