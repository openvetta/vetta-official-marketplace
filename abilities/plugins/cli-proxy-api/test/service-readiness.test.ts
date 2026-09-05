import { afterEach, describe, expect, it, vi } from "vitest";
import { maintainServiceReadiness } from "../src/service-readiness";
import { fixture } from "./helpers";

afterEach(() => vi.useRealTimers());

describe("CLIProxyAPI semantic service readiness", () => {
  it("reports ready only after the host exposes transport access", async () => {
    const f = fixture();
    f.context.services.getStatus = vi.fn(async () => ({ ...f.ready, phase: "starting" }));
    const readiness = maintainServiceReadiness(f.context);

    await vi.waitFor(() => expect(f.reportReady).toHaveBeenCalledWith("proxy", true));

    await readiness.dispose();
  });

  it("keeps waiting while an active account has no models", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = fixture();
    let modelReads = 0;
    f.context.services.getStatus = vi.fn(async () => ({ ...f.ready, phase: "starting" }));
    f.handle.mockImplementation(async (request: { path: string }) => {
      if (request.path === "/v0/management/auth-files") {
        return { files: [{ provider: "google", name: "user.json", email: "user@example.com" }] };
      }
      if (request.path === "/v1/models") {
        modelReads += 1;
        return modelReads < 2 ? { data: [] } : { data: [{ id: "gemini-test", owned_by: "google" }] };
      }
      return { data: [] };
    });
    const readiness = maintainServiceReadiness(f.context);

    await vi.waitFor(() => expect(f.reportReady).toHaveBeenCalledWith("proxy", true));
    expect(modelReads).toBeGreaterThanOrEqual(2);
    await readiness.dispose();
  });
});
