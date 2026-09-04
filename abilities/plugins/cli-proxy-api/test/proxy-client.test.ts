import { describe, expect, it, vi } from "vitest";
import { createProxyClient, safeExternalUrl } from "../src/proxy-client";
import { OAUTH_PROVIDERS, protocolGroupFor } from "../src/provider-contract";
import { maintainModelConnection } from "../src/model-connection";
import { fixture } from "./helpers";

describe("CLIProxyAPI contracts", () => {
  it("selects known native protocols and keeps unknown owners on compatible Completions", () => {
    expect(protocolGroupFor("google", "alias")).toBe("google");
    expect(protocolGroupFor("antigravity", "claude-sonnet")).toBe("anthropic");
    expect(protocolGroupFor("kimi", "alias")).toBe("anthropic");
    expect(protocolGroupFor("openai", "alias")).toBe("responses");
    expect(protocolGroupFor("openrouter", "gpt-or-claude-or-gemini")).toBe("completions");
    expect(protocolGroupFor("", "gemini")).toBe("completions");
  });
  it("uses callback forwarders for desktop browser flows and device flows for Kimi/xAI", () => {
    for (const id of ["claude", "codex", "antigravity"]) expect(OAUTH_PROVIDERS.find((p) => p.id === id)?.authPath).toContain("is_webui=true");
    expect(OAUTH_PROVIDERS.filter((p) => p.deviceFlow).map((p) => p.id)).toEqual(["kimi", "xai"]);
    for (const url of ["javascript:alert(1)", "http://localhost", "https://name:secret@example.com"]) expect(() => safeExternalUrl(url)).toThrow();
  });
  it("registers discovered models without leaking the management key and rejects malformed catalogs", async () => {
    const f = fixture();
    const client = createProxyClient(f.context);
    expect(() => client.readModels({ unexpected: [] })).toThrow("model catalog");
    await client.publishModels(client.readModels({ data: [
      { id: "g", owned_by: "google" }, { id: "g", owned_by: "google" },
      { id: "c", owned_by: "claude" }, { id: "o", owned_by: "codex" }, { id: "x", owned_by: "unknown" }
    ] }));
    expect(f.upsertProvider.mock.calls).toEqual([
      ["google", expect.objectContaining({ baseUrl: "http://127.0.0.1:12345/v1beta", apiKey: "local-api-key", api: "google-generative-ai", models: [{ id: "g", api: "google-generative-ai" }] })],
      ["anthropic", expect.objectContaining({ baseUrl: "http://127.0.0.1:12345", api: "anthropic-messages" })],
      ["responses", expect.objectContaining({ api: "openai-responses" })],
      ["completions", expect.objectContaining({ api: "openai-completions" })]
    ]);
    expect(f.context.services.connection).toHaveBeenCalledWith("proxy", "api-key");
  });
  it("publishes the upstream context window instead of letting the host fall back to 128k", async () => {
    const f = fixture();
    const client = createProxyClient(f.context);
    const { models, catalog } = await client.loadModels();
    expect(models).toEqual([{ id: "gemini-test", ownedBy: "google", contextWindow: 1048576, maxTokens: 65536, reasoning: true }]);
    // The channel listing is what the workspace view renders as "supported models".
    expect(catalog.channels.get("gemini")).toEqual([
      { id: "gemini-test", contextWindow: 1048576, maxTokens: 65536, reasoning: true }
    ]);
    await client.publishModels(models);
    expect(f.upsertProvider).toHaveBeenCalledWith("google", expect.objectContaining({
      models: [{ id: "gemini-test", api: "google-generative-ai", contextWindow: 1048576, maxTokens: 65536, reasoning: true }]
    }));
  });
  it("omits figures the catalog does not state and survives channels the runtime rejects", async () => {
    const f = fixture();
    f.handle.mockImplementation(async (request: { path: string }) => {
      if (request.path === "/v1/models") return { data: [{ id: "mystery", owned_by: "kimi" }] };
      if (request.path === "/v0/management/model-definitions/kimi") {
        // context_length 0 is upstream's "unknown"; publishing it would fail host validation.
        return { models: [{ id: "mystery", owned_by: "kimi", context_length: 0 }] };
      }
      throw new Error("unknown channel");
    });
    const client = createProxyClient(f.context);
    const { models } = await client.loadModels();
    expect(models).toEqual([{ id: "mystery", ownedBy: "kimi" }]);
    await client.publishModels(models);
    expect(f.upsertProvider).toHaveBeenCalledWith("anthropic", expect.objectContaining({
      models: [{ id: "mystery", api: "anthropic-messages" }]
    }));
  });
  it("keeps account identity and removal capability without exposing upstream paths", () => {
    const client = createProxyClient(fixture().context);
    expect(client.readAccounts({ files: [
      {
        auth_index: "codex-1",
        name: "codex-user@example.com.json",
        provider: "codex",
        email: "user@example.com",
        path: "C:/private/auths/codex-user@example.com.json",
        disabled: false,
        unavailable: false,
        runtime_only: false,
        source: "file"
      },
      {
        auth_index: "memory-1",
        name: "virtual-account",
        provider: "xai",
        label: "Runtime account",
        runtime_only: true,
        source: "memory"
      },
      null
    ] })).toEqual([
      {
        key: "codex-1:0",
        provider: "codex",
        displayName: "user@example.com",
        deleteName: "codex-user@example.com.json",
        active: true,
        removable: true,
        email: "user@example.com",
        success: 0,
        failed: 0,
        recentRequests: []
      },
      {
        key: "memory-1:1",
        provider: "xai",
        displayName: "Runtime account",
        deleteName: "virtual-account",
        active: true,
        removable: false,
        success: 0,
        failed: 0,
        recentRequests: []
      }
    ]);
  });
  it("updates the endpoint on restart without mounting the UI and ignores repeated ready log events", async () => {
    const f = fixture();
    const connection = maintainModelConnection(f.context);
    await vi.waitFor(() => expect(f.upsertProvider).toHaveBeenCalledTimes(1));
    f.emit({ ...f.ready, recentOutput: "log" });
    f.emit({ ...f.ready, phase: "stopped" });
    f.setBaseUrl("http://127.0.0.1:23456");
    f.emit(f.ready);
    await vi.waitFor(() => expect(f.upsertProvider).toHaveBeenCalledTimes(2));
    expect(f.upsertProvider).toHaveBeenLastCalledWith("google", expect.objectContaining({ baseUrl: "http://127.0.0.1:23456/v1beta" }));
    await connection.dispose();
    f.emit({ ...f.ready, phase: "stopped" });
    f.emit(f.ready);
    expect(f.upsertProvider).toHaveBeenCalledTimes(2);
  });
});
