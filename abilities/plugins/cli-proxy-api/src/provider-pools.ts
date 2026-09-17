import { modelRouteKey, type ModelRouteKey } from "./model-selection";
import { protocolGroupFor, type OAuthProviderId } from "./provider-contract";
import type { ChannelModel, ProxyAccount } from "./proxy-client";

export type AccountModelState = { models: ChannelModel[]; error?: string };

export type ProviderPoolModel = ChannelModel & {
  routeKey: ModelRouteKey;
  availableAccountKeys: readonly string[];
  enabledAccountCount: number;
};

export type ProviderPool = {
  id: string;
  provider?: OAuthProviderId;
  accounts: readonly ProxyAccount[];
  enabledAccountCount: number;
  models: readonly ProviderPoolModel[];
  errors: readonly string[];
};

function canonicalProvider(account: ProxyAccount): { id: string; provider?: OAuthProviderId } {
  const value = account.provider.trim().toLowerCase();
  if (value === "anthropic") return { id: "claude", provider: "claude" };
  if (value === "gemini") return { id: "gemini-cli", provider: "gemini-cli" };
  const known: OAuthProviderId[] = ["gemini-cli", "codex", "claude", "antigravity", "kimi", "xai"];
  return known.includes(value as OAuthProviderId)
    ? { id: value, provider: value as OAuthProviderId }
    : { id: value || "unknown" };
}

export function buildProviderPools(
  accounts: readonly ProxyAccount[],
  accountModels: ReadonlyMap<string, AccountModelState>,
): ProviderPool[] {
  const groups = new Map<string, { provider?: OAuthProviderId; accounts: ProxyAccount[] }>();
  for (const account of accounts) {
    const canonical = canonicalProvider(account);
    const group = groups.get(canonical.id) ?? { provider: canonical.provider, accounts: [] };
    group.accounts.push(account);
    groups.set(canonical.id, group);
  }
  return [...groups.entries()].map(([id, group]) => {
    const models = new Map<ModelRouteKey, { model: ChannelModel; accounts: string[] }>();
    const errors: string[] = [];
    for (const account of group.accounts) {
      const state = accountModels.get(account.key);
      if (state?.error) errors.push(state.error);
      for (const model of state?.models ?? []) {
        const routeKey = modelRouteKey({ id: model.id, group: protocolGroupFor(account.provider, model.id) });
        const current = models.get(routeKey);
        if (current) current.accounts.push(account.key);
        else models.set(routeKey, { model, accounts: [account.key] });
      }
    }
    const enabledAccountCount = group.accounts.filter((account) => !account.disabled).length;
    return {
      id,
      ...(group.provider ? { provider: group.provider } : {}),
      accounts: group.accounts,
      enabledAccountCount,
      errors,
      models: [...models.entries()]
        .map(([routeKey, value]) => ({
          ...value.model,
          routeKey,
          availableAccountKeys: value.accounts,
          enabledAccountCount: value.accounts.filter((key) => !group.accounts.find((account) => account.key === key)?.disabled).length,
        }))
        .sort((left, right) => left.routeKey.localeCompare(right.routeKey)),
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
}
