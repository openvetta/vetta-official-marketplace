import { describe, expect, it } from "vitest";
import { groupModels, reconcileModels, type ReconcileSources } from "../src/model-reconciler";
import type { ChannelModel, ModelCatalog, ProxyAccount, ProxyModel } from "../src/proxy-client";

function catalogOf(channels: Record<string, ChannelModel[]>): ModelCatalog {
  const entries = new Map(Object.entries(channels));
  return { size: 0, channels: entries, lookup: () => undefined };
}

function account(provider: string, overrides: Partial<ProxyAccount> = {}): ProxyAccount {
  return {
    key: `${provider}:0`, provider, displayName: provider, active: true, disabled: false,
    removable: true, success: 0, failed: 0, recentRequests: [], ...overrides
  };
}

const ANTIGRAVITY_CHANNEL: ChannelModel[] = [{ id: "gemini-3-flash" }, { id: "claude-sonnet-4-6" }];
const CODEX_CHANNEL: ChannelModel[] = [{ id: "gpt-5.5" }];
const codexModel: ProxyModel = { id: "gpt-5.5", ownedBy: "openai" };

function sources(overrides: Partial<ReconcileSources> = {}): ReconcileSources {
  return {
    published: groupModels([{ id: "gemini-3-flash", ownedBy: "antigravity" }, { id: "claude-sonnet-4-6", ownedBy: "antigravity" }, codexModel]),
    routable: [codexModel],
    accounts: [account("antigravity"), account("codex")],
    catalog: catalogOf({ antigravity: ANTIGRAVITY_CHANNEL, codex: CODEX_CHANNEL }),
    ...overrides
  };
}

describe("model reconciliation", () => {
  it("keeps a credential's models while the gateway is still registering them", () => {
    // The reported cold start: /v1/models answers with codex a second or two
    // before antigravity finishes registering, and publishing that read as the
    // whole truth is what used to erase the antigravity models on every launch.
    expect(reconcileModels(sources()).map((model) => `${model.group}/${model.id}`)).toEqual([
      "anthropic/claude-sonnet-4-6", "google/gemini-3-flash", "responses/gpt-5.5"
    ]);
  });

  it("drops the models of a credential that is gone or switched off", () => {
    expect(reconcileModels(sources({ accounts: [account("codex")] })).map((model) => model.id)).toEqual(["gpt-5.5"]);
    const disabled = [account("antigravity", { active: false, disabled: true }), account("codex")];
    expect(reconcileModels(sources({ accounts: disabled })).map((model) => model.id)).toEqual(["gpt-5.5"]);
  });

  it("drops a model its own channel answered without", () => {
    const catalog = catalogOf({ antigravity: [{ id: "gemini-3-flash" }], codex: CODEX_CHANNEL });
    expect(reconcileModels(sources({ catalog })).map((model) => model.id)).toEqual(["gemini-3-flash", "gpt-5.5"]);
  });

  it("keeps everything when a backing channel answered nothing at all", () => {
    // Unknown is not denial: the credential is there, this pass just could not
    // ask it. Dropping here would be the same defect with a different trigger.
    const catalog = catalogOf({ codex: CODEX_CHANNEL });
    expect(reconcileModels(sources({ catalog })).map((model) => model.id)).toEqual([
      "claude-sonnet-4-6", "gemini-3-flash", "gpt-5.5"
    ]);
  });

  it("keeps everything for a credential whose provider the plugin does not model", () => {
    const accounts = [account("openai-compatibility"), account("codex")];
    expect(reconcileModels(sources({ accounts })).map((model) => model.id)).toEqual([
      "claude-sonnet-4-6", "gemini-3-flash", "gpt-5.5"
    ]);
  });

  it("publishes only what is routable when the host offers no read-back", () => {
    expect(reconcileModels(sources({ published: undefined })).map((model) => model.id)).toEqual(["gpt-5.5"]);
  });

  it("prefers the freshly read capabilities over the published copy", () => {
    const routable: ProxyModel[] = [{ id: "gemini-3-flash", ownedBy: "antigravity", contextWindow: 1_048_576 }];
    const reconciled = reconcileModels(sources({ routable }));
    expect(reconciled.find((model) => model.id === "gemini-3-flash")).toMatchObject({ contextWindow: 1_048_576 });
  });
});
