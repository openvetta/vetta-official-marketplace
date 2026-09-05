import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProxySetupSlot } from "../src/setup-slot";
import { fixture } from "./helpers";

vi.mock("@vetta-org/plugin-sdk", () => {
  const t = (key: string, values?: { details?: string }) => values?.details ? `${key} ${values.details}` : key;
  return { useTranslation: () => ({ t }) };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("CLIProxyAPI setup", () => {
  it("hands account management to the console instead of duplicating it", async () => {
    const f = fixture();
    render(<ProxySetupSlot context={f.context} />);

    // Nothing on this slot authorizes, lists or removes a credential any more:
    // two surfaces driving the same gateway could not stay in agreement.
    await screen.findByText("setup.title");
    expect(screen.queryByRole("button", { name: /setup\.connect/u })).toBeNull();
    expect(screen.queryByRole("button", { name: /setup\.removeAccount/u })).toBeNull();
    expect(screen.queryByText("setup.oauthTitle")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "console.openConsole" }));
    expect(f.openWorkspaceView).toHaveBeenCalledWith("console");
  });

  it("shows progress and completion feedback when the user manually syncs models", async () => {
    const f = fixture();
    let finishPublish!: () => void;
    f.replaceOwnedProviders.mockImplementation(async () => await new Promise<void>((resolve) => { finishPublish = resolve; }));
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    render(<ProxySetupSlot context={f.context} />);
    const button = await screen.findByRole("button", { name: "setup.syncModels" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(button);

    const syncingButton = await screen.findByRole("button", { name: "setup.syncingModels" });
    expect((syncingButton as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(f.replaceOwnedProviders).toHaveBeenCalled());
    expect(info).toHaveBeenCalledWith("[cli-proxy-api] Model sync started.");

    await act(async () => { finishPublish(); });

    expect((await screen.findByRole("status")).textContent).toBe("setup.syncSuccess");
    expect(info).toHaveBeenCalledWith("[cli-proxy-api] Model sync completed: 1 model(s).");
  });

  it("shows and logs the operation context when manual model sync fails", async () => {
    const f = fixture();
    f.replaceOwnedProviders.mockRejectedValue(new Error("provider write failed"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ProxySetupSlot context={f.context} />);
    const button = await screen.findByRole("button", { name: "setup.syncModels" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(button);

    expect((await screen.findByRole("alert")).textContent).toBe("setup.syncFailed provider write failed");
    expect(error).toHaveBeenCalledWith("[cli-proxy-api] Model sync failed: provider write failed");
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

});
