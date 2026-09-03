import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureServiceStarted, runtimeAssets } from "../src/runtime-provisioner";
import { fixture } from "./helpers";

const originalAssets = runtimeAssets["win32-x64"].map((asset) => ({ ...asset }));

afterEach(() => {
  runtimeAssets["win32-x64"] = originalAssets.map((asset) => ({ ...asset }));
});

describe("CLIProxyAPI runtime provisioning", () => {
  it("downloads and verifies its own runtime before handing archives to the service host", async () => {
    const f = fixture();
    const payloads = [Buffer.from("core"), Buffer.from("provider")];
    runtimeAssets["win32-x64"] = runtimeAssets["win32-x64"].map((asset, index) => ({
      ...asset,
      sha256: createHash("sha256").update(payloads[index]).digest("hex")
    }));
    f.context.services.getStatus = vi.fn(async () => ({ ...f.ready, phase: "stopped", installed: false }));
    f.context.network.request = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {},
      body: payloads.shift()?.toString("base64") ?? ""
    }));
    f.context.services.install = vi.fn(async (_id, artifacts) => ({ ...f.ready, phase: "stopped", installed: artifacts.length === 2 }));

    await expect(ensureServiceStarted(f.context)).resolves.toEqual(f.ready);
    expect(f.context.network.request).toHaveBeenCalledTimes(2);
    expect(f.context.services.install).toHaveBeenCalledWith("proxy", [
      { destination: "core", data: Buffer.from("core").toString("base64") },
      { destination: "plugins", data: Buffer.from("provider").toString("base64") }
    ]);
    expect(f.context.services.start).toHaveBeenCalledWith("proxy");
  });

  it("rejects a tampered download before the host install API is called", async () => {
    const f = fixture();
    f.context.services.getStatus = vi.fn(async () => ({ ...f.ready, phase: "stopped", installed: false }));
    f.context.network.request = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", headers: {}, body: "dGFtcGVyZWQ=" }));

    await expect(ensureServiceStarted(f.context)).rejects.toThrow("checksum mismatch");
    expect(f.context.services.install).not.toHaveBeenCalled();
    expect(f.context.services.start).not.toHaveBeenCalled();
  });
});
