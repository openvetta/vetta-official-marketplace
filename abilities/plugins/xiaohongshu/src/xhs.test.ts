import { describe, expect, it, vi } from "vitest";
import { renderQrCode } from "./qr";
import { readAccountState, switchAccount } from "./xhs";

function context() {
  const files = new Map<string, unknown>();
  const secrets = new Map<string, string>([["session:account-a", JSON.stringify({ version: 2, seed: "seed-a", cookies: [{ name: "a" }] })]]);
  const service = {
    stop: vi.fn(async () => ({ phase: "stopped" })),
    start: vi.fn(async () => ({ phase: "starting" })),
    writeDataFile: vi.fn(async (_service: string, _path: string, data: string) => { files.set("cookies.json", JSON.parse(data)); }),
    readDataFile: vi.fn(async () => JSON.stringify(files.get("cookies.json"))),
    request: vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", body: { data: { is_logged_in: true } } })),
  };
  const ctx = {
    storage: {
      readJson: vi.fn(async () => files.get("accounts.json") ?? null),
      writeJson: vi.fn(async (_path: string, value: unknown) => { files.set("accounts.json", value); }),
    },
    secrets: {
      get: vi.fn(async (key: string) => secrets.get(key)),
      set: vi.fn(async (key: string, value: string) => { secrets.set(key, value); }),
      delete: vi.fn(async (key: string) => { secrets.delete(key); }),
    },
    services: service,
  } as never;
  files.set("accounts.json", {
    schemaVersion: 1,
    activeAccountId: "account-b",
    accounts: [
      { id: "account-a", name: "账号 A", createdAt: "2026-01-01", status: "connected" },
      { id: "account-b", name: "账号 B", createdAt: "2026-01-02", status: "unknown" },
    ],
  });
  return { ctx, service };
}

describe("xiaohongshu plugin account handling", () => {
  it("renders QR codes inside the plugin without a host QR API", async () => {
    expect(await renderQrCode("https://example.test/login")).toMatch(/^data:image\/png;base64,/);
  });

  it("writes the complete opaque session before restarting the service", async () => {
    const { ctx, service } = context();
    await switchAccount(ctx, "account-a");
    expect(service.stop).toHaveBeenCalledBefore(service.writeDataFile);
    expect(service.writeDataFile.mock.calls[0]?.[2]).toContain('"seed":"seed-a"');
    expect(service.start).toHaveBeenCalledAfter(service.writeDataFile);
    expect(await readAccountState(ctx)).toMatchObject({ activeAccountId: "account-a" });
  });
});
