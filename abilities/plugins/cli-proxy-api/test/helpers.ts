import { vi } from "vitest";
import type { ManagedPluginContext, ServiceStatus } from "../src/runtime-contract";

export function fixture() {
  const ready: ServiceStatus = { serviceId: "proxy", phase: "ready", version: "test", installed: true, recentOutput: "" };
  const listeners = new Set<(status: ServiceStatus) => void>();
  let baseUrl = "http://127.0.0.1:12345";
  const handle = vi.fn(async (request: { path: string; method?: string }): Promise<unknown> => {
    if (request.path === "/v1/models") return { data: [{ id: "gemini-test", owned_by: "google" }] };
    if (request.path === "/v0/management/model-definitions/gemini") {
      return { channel: "gemini", models: [{ id: "gemini-test", owned_by: "google", context_length: 1048576, max_completion_tokens: 65536, thinking: { levels: ["low", "high"] } }] };
    }
    if (request.path.startsWith("/v0/management/model-definitions/")) return { channel: "other", error: "unknown channel" };
    if (request.path === "/v0/management/auth-files") return { files: [] };
    if (request.path.includes("auth-url")) return { status: "ok", url: "https://accounts.example.com/oauth", state: "state-1", user_code: "ABCD-EFGH" };
    if (request.method === "DELETE") return { status: "ok", cancelled: true };
    return { status: "wait" };
  });
  const replaceOwnedProviders = vi.fn(async () => undefined);
  const reportReady = vi.fn(async () => ready);
  const openExternal = vi.fn(async () => undefined);
  const setWorkspaceViewHeader = vi.fn();
  const openWorkspaceView = vi.fn();
  const writeFile = vi.fn(async () => ({ revision: "revision-1", changedPaths: ["published-models.json"] }));
  const readFile = vi.fn(async () => null);
  const reload = vi.fn();
  // jsdom refuses navigation; the apply flow ends in a reload we need to observe.
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
  const context = {
    services: {
      getPlatform: vi.fn(async () => ({ tag: "win32-x64" })),
      getStatus: vi.fn(async () => ready), install: vi.fn(async () => ready), start: vi.fn(async () => ready), stop: vi.fn(), restart: vi.fn(async () => ready),
      reportReady, connection: vi.fn(async () => ({ baseUrl, credential: "local-api-key" })),
      request: vi.fn(async (_id: string, request: { path: string; method?: string; body?: unknown }) => ({
        ok: true, status: 200, statusText: "OK", body: await handle(request)
      })),
      onStatusChange: (listener: (status: ServiceStatus) => void) => {
        listeners.add(listener); return { dispose: () => { listeners.delete(listener); } };
      }
    },
    models: { replaceOwnedProviders },
    network: { request: vi.fn() },
    storage: { readFile, writeFile },
    ui: { openExternal, setWorkspaceViewHeader, openWorkspaceView }
  } as unknown as ManagedPluginContext;
  return { context, ready, handle, replaceOwnedProviders, reportReady, openExternal, setWorkspaceViewHeader, openWorkspaceView, writeFile, readFile, reload,
    emit: (status: ServiceStatus) => { for (const listener of listeners) listener(status); },
    setBaseUrl: (url: string) => { baseUrl = url; }
  };
}
