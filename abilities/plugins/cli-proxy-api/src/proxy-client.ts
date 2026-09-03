import { protocolGroupFor, type ProtocolGroup } from "./provider-contract";
import type { ManagedPluginContext } from "./runtime-contract";

export const SERVICE_ID = "proxy";
export const MANAGER_CREDENTIAL = "management-key";
export const API_CREDENTIAL = "api-key";
export type JsonRecord = Record<string, unknown>;
export type ProxyModel = { id: string; ownedBy: string };
export type ProxyAccount = {
  key: string;
  provider: string;
  displayName: string;
  deleteName?: string;
  active: boolean;
  removable: boolean;
};

export function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}

export function textField(value: JsonRecord | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

export function safeExternalUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid authentication URL");
  return url.toString();
}


export function createProxyClient(pluginContext: ManagedPluginContext) {
async function serviceRequest<T>(path: string, options: {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  credentialId: string;
  body?: unknown;
}): Promise<T> {
  const response = await pluginContext.services.request<T>(SERVICE_ID, {
    path,
    method: options.method,
    credentialId: options.credentialId,
    body: options.body,
    timeoutMs: 30000
  });
  if (!response.ok) {
    const message = textField(record(response.body), "error", "message") ?? `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return response.body;
}

function readModels(value: unknown): ProxyModel[] {
  const data = record(value)?.data;
  if (!Array.isArray(data)) throw new Error("Invalid model catalog response");
  const seen = new Set<string>();
  const models: ProxyModel[] = [];
  for (const item of data) {
    const entry = record(item);
    const id = textField(entry, "id");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({ id, ownedBy: textField(entry, "owned_by", "ownedBy") ?? "" });
  }
  return models.sort((left, right) => left.id.localeCompare(right.id));
}

function readAccounts(value: unknown): ProxyAccount[] {
  const files = record(value)?.files;
  if (!Array.isArray(files)) return [];
  const accounts: ProxyAccount[] = [];
  for (const [index, item] of files.entries()) {
    const entry = record(item);
    if (!entry) continue;
    const provider = textField(entry, "provider", "type", "account_type") ?? "unknown";
    const deleteName = textField(entry, "name");
    const stableId = textField(entry, "auth_index", "id", "name") ?? provider;
    const displayName = textField(entry, "email", "label", "account", "id", "name") ?? provider;
    const runtimeOnly = entry.runtime_only === true || textField(entry, "source") === "memory";
    accounts.push({
      key: `${stableId}:${index}`,
      provider,
      displayName,
      ...(deleteName ? { deleteName } : {}),
      active: entry.disabled !== true && entry.unavailable !== true,
      removable: !runtimeOnly && Boolean(deleteName)
    });
  }
  return accounts.sort((left, right) => left.provider.localeCompare(right.provider) || left.displayName.localeCompare(right.displayName));
}

const PROVIDER_CONFIG: Record<ProtocolGroup, { basePath: string; api: string; title: string }> = {
  google: { basePath: "/v1beta", api: "google-generative-ai", title: "CLIProxyAPI · Google" },
  anthropic: { basePath: "", api: "anthropic-messages", title: "CLIProxyAPI · Anthropic" },
  responses: { basePath: "/v1", api: "openai-responses", title: "CLIProxyAPI · Responses" },
  completions: { basePath: "/v1", api: "openai-completions", title: "CLIProxyAPI · Compatible" }
};

async function publishModels(models: ProxyModel[], isCurrent = () => true): Promise<void> {
  const connection = await pluginContext.services.connection(SERVICE_ID, API_CREDENTIAL);
  if (!connection.credential) throw new Error("The managed API credential is unavailable");
  const groups = new Map<ProtocolGroup, ProxyModel[]>();
  for (const model of models) {
    const group = protocolGroupFor(model.ownedBy, model.id);
    groups.set(group, [...(groups.get(group) ?? []), model]);
  }
  for (const group of Object.keys(PROVIDER_CONFIG) as ProtocolGroup[]) {
    if (!isCurrent()) return;
    const definitions = groups.get(group) ?? [];
    if (definitions.length === 0) {
      await pluginContext.models.removeProvider(group);
      continue;
    }
    const config = PROVIDER_CONFIG[group];
    await pluginContext.models.upsertProvider(group, {
      baseUrl: `${connection.baseUrl}${config.basePath}`,
      apiKey: connection.credential,
      api: config.api,
      displayName: config.title,
      models: definitions.map((model) => ({ id: model.id, api: config.api }))
    });
  }
}


return { serviceRequest, readModels, readAccounts, publishModels };
}
