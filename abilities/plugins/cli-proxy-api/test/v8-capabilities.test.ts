import { describe, expect, it, vi } from "vitest";
import { readNormalizedQuota } from "../src/domain/normalized-quota";
import { createProxyClient } from "../src/proxy-client";
import { hasQuotaProbe, probeAccountQuota } from "../src/quota-probe";
import { fixture } from "./helpers";
import { buildProviderPools } from "../src/provider-pools";
import { reconcileModels } from "../src/model-reconciler";

describe("CPA v8 capabilities", () => {
  it("keeps mixed Devin model protocols aligned across picker, publication and restart retention", async () => {
    const f = fixture();
    const entries = [
      { id: "devin/claude-fable-5-1", owned_by: "anthropic" },
      { id: "devin/gemini-3-8-flash", owned_by: "google" },
    ];
    f.handle.mockImplementation(async ({ path }) => {
      if (path === "/v1/models") return { data: entries };
      if (path.endsWith("/devin") || path.includes("/credentials/models")) return { models: entries };
      return { models: [] };
    });
    const client = createProxyClient(f.context);
    const [account] = client.readAccounts({ files: [{ name: "devin.json", auth_index: "d1", provider: "devin" }] });
    const { models, catalog } = await client.loadModels();
    const fetched = await client.fetchAccountModels(account!, catalog);
    const pools = buildProviderPools([account!], new Map([[account!.key, { models: fetched }]]));
    expect(pools[0]?.models.map((model) => model.routeKey)).toEqual(["anthropic/devin/claude-fable-5-1", "google/devin/gemini-3-8-flash"]);
    const published = reconcileModels({ published: [], routable: models, accounts: [account!], catalog }).models;
    expect(reconcileModels({ published, routable: [], accounts: [account!], catalog }).models).toEqual(published);
  });

  it("publishes image input, shows upstream modalities, and retains host input during discovery gaps", async () => {
    const f = fixture();
    let ready = true;
    f.handle.mockImplementation(async ({ path }) => {
      if (path === "/v1/models") return { data: ready ? [{ id: "vision-model", owned_by: "openai", native_capabilities: { web_search: false } }] : [] };
      if (path === "/v8/management/credentials") return { files: [{ name: "codex.json", provider: "codex" }] };
      if (path.endsWith("/codex") && ready) return { models: [{ id: "vision-model", owned_by: "openai",
        supportedInputModalities: ["text", "image", "audio"], native_capabilities: { web_search: true } }] };
      throw new Error("discovery unavailable");
    });
    const client = createProxyClient(f.context);
    const first = await client.loadPublishableModels();
    expect(first.models[0]).toMatchObject({ input: ["text", "image"], inputModalities: ["text", "image", "audio"], nativeWebSearch: false });
    await client.publishModels(first.models);
    expect(f.replaceOwnedProviders).toHaveBeenLastCalledWith(expect.objectContaining({ responses: expect.objectContaining({
      models: [{ id: "vision-model", api: "openai-responses", input: ["text", "image"] }],
    }) }));
    ready = false;
    const retained = await client.loadPublishableModels();
    expect(retained.models[0]?.input).toEqual(["text", "image"]);
  });

  it.each([["text", 42], ["text", "unknown"], []])("does not invent supported input from malformed modalities: %j", async (...input) => {
    const f = fixture();
    const client = createProxyClient(f.context);
    expect(client.readModels({ data: [{ id: "custom", supportedInputModalities: input }] })[0]?.input).toBeUndefined();
  });

  it("reads cooldowns and quota support without passing through credential data", () => {
    const client = createProxyClient(fixture().context);
    const [account] = client.readAccounts({ files: [{ name: "meta.json", auth_index: "meta-1", provider: "meta",
      access_token: "should-not-escape", supports_quota: true, quota_provider: "meta", quota_probe: { secret: "hidden" },
      cooldowns: [{ scope: "model", model_key: "muse", reason: "quota", retry_at: "2026-10-08T00:00:00Z", remaining_seconds: 60, http_status: 429 },
        { scope: "credential", retry_at: "invalid" }],
    }] });
    expect(account).toMatchObject({ supportsQuota: true, hasDeclarativeQuotaProbe: true,
      cooldowns: [{ scope: "model", model: "muse", httpStatus: 429 }] });
    expect(account?.cooldowns).toHaveLength(1);
    expect(JSON.stringify(account)).not.toMatch(/should-not-escape|hidden/);
  });

  it("refreshes only the selected credential and discards refreshed tokens", async () => {
    const f = fixture();
    f.handle.mockResolvedValue({ ok: true, auth: { access_token: "must-stay-in-cpa" } });
    const client = createProxyClient(f.context);
    const [account] = client.readAccounts({ files: [{ name: "devin.json", auth_index: "d1", provider: "devin" }] });
    await expect(client.refreshAccountCredential(account!)).resolves.toBeUndefined();
    expect(f.handle).toHaveBeenCalledWith(expect.objectContaining({ path: "/v8/management/credentials/refresh", method: "POST", body: { name: "devin.json", auth_index: "d1" } }));
    expect(f.writeFile).not.toHaveBeenCalled();
    f.handle.mockResolvedValue({ ok: false });
    await expect(client.refreshAccountCredential(account!)).rejects.toThrow("did not complete");
  });

  it("uses enabled quota plugins and the retained generic route for declarative providers", async () => {
    const client = createProxyClient(fixture().context);
    const [account] = client.readAccounts({ files: [{ name: "meta.json", auth_index: "m1", provider: "meta", supports_quota: true }] });
    expect(hasQuotaProbe(account!)).toBe(true);
    let enabled = true;
    const request = vi.fn(async (path: string) => path === "/v8/management/plugins"
      ? { plugins: [{ id: "meta-quota", effective_enabled: enabled, supports_quota: true, quota_provider: "meta" }] }
      : { summary: [{ key: "remaining", label: "Remaining credits", value: 12.5, format: "number" }] });
    expect(await probeAccountQuota(request as never, "management-key", account!)).toMatchObject({ summary: [{ value: 12.5 }] });
    expect(request).toHaveBeenLastCalledWith("/v8/management/plugins/meta-quota/quota", expect.objectContaining({ body: { auth_index: "m1" } }));
    enabled = false;
    await probeAccountQuota(request as never, "management-key", account!);
    expect(request).toHaveBeenLastCalledWith("/v0/management/quota/fetch", expect.anything());
  });

  it("normalizes quota aliases and rejects invalid numbers without showing unlimited quota", () => {
    expect(readNormalizedQuota({ groups: [{ display_name: "Weekly", buckets: [{ remaining_fraction: 0.4, reset_time: "2026-10-08T00:00:00Z" }] }],
      summary: [{ key: "cost", label: "Cost", value: 5.2, format: "currency", currency: "USD" }, { key: "invalid", label: "Invalid", value: Infinity }] })).toMatchObject({
      groups: [{ name: "Weekly", windows: [{ remainingPercent: 40 }] }], summary: [{ key: "cost", value: 5.2, currency: "USD" }],
    });
    expect(readNormalizedQuota({ groups: [{ buckets: [{ remainingFraction: "bad" }] }] })).toBeUndefined();
  });
});
