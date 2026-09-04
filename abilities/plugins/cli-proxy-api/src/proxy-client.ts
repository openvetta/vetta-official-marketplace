import { MODEL_DEFINITION_CHANNELS, protocolGroupFor, type ProtocolGroup } from "./provider-contract";
import type { ManagedPluginContext } from "./runtime-contract";

export const SERVICE_ID = "proxy";
export const MANAGER_CREDENTIAL = "management-key";
export const API_CREDENTIAL = "api-key";
export type JsonRecord = Record<string, unknown>;

/**
 * The capability fields Vetta stores per model. Everything here is optional
 * because the upstream catalog leaves it out for models it has no figures for,
 * and guessing is worse than the host default: a wrong context window makes the
 * agent compact too early or overflow the upstream request.
 */
export type ModelMetadata = { contextWindow?: number; maxTokens?: number; reasoning?: boolean };
export type ProxyModel = { id: string; ownedBy: string } & ModelMetadata;

/** One model as the upstream channel catalog describes it, before any account is connected. */
export type ChannelModel = { id: string; displayName?: string } & ModelMetadata;

/** Resolves a model advertised by `/v1/models` to its upstream capabilities. */
export type ModelCatalog = {
  lookup(id: string, ownedBy: string): ModelMetadata | undefined;
  size: number;
  /** Everything each channel says it can route, keyed by channel name. */
  channels: ReadonlyMap<string, ChannelModel[]>;
};

/** A ten-minute request bucket as reported by `/v0/management/auth-files`. */
export type UsageBucket = { time: string; success: number; failed: number };

export type ProxyAccount = {
  key: string;
  provider: string;
  displayName: string;
  deleteName?: string;
  active: boolean;
  removable: boolean;
  /** Upstream health, absent on gateways that report no counters for the credential. */
  status?: string;
  statusMessage?: string;
  email?: string;
  lastRefresh?: string;
  success: number;
  failed: number;
  recentRequests: UsageBucket[];
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

/** Request counters are absent on gateways that never served the credential. */
function counter(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

function readUsageBuckets(value: unknown): UsageBucket[] {
  if (!Array.isArray(value)) return [];
  const buckets: UsageBucket[] = [];
  for (const item of value) {
    const entry = record(item);
    const time = textField(entry, "time");
    if (!time) continue;
    buckets.push({ time, success: counter(entry?.success), failed: counter(entry?.failed) });
  }
  return buckets;
}

/** Upstream sends `0` for "unknown"; a zero context window would fail host validation. */
export function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Reads one `/v0/management/model-definitions` entry. Absent figures stay absent. */
function readModelMetadata(entry: JsonRecord): ModelMetadata {
  const contextWindow = positiveInteger(entry.context_length);
  const maxTokens = positiveInteger(entry.max_completion_tokens);
  return {
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    // A `thinking` block is upstream's own statement that the model reasons.
    ...(record(entry.thinking) ? { reasoning: true } : {})
  };
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

/**
 * Builds the capability catalog from `/v0/management/model-definitions`.
 *
 * `/v1/models` is an OpenAI-shaped list — it carries `id` and `owned_by` and
 * nothing else — so publishing straight from it left every model without a
 * context window and the host fell back to its 128k default, shrinking 1M-token
 * models to an eighth of their real budget. The management route is the only
 * place the runtime states the real figures.
 *
 * Channels are queried concurrently but merged in declaration order so the same
 * gateway always yields the same catalog. A channel the runtime rejects, or one
 * whose entry carries no figures at all, simply contributes nothing: several
 * channels list the same model id and only some of them know its limits.
 */
async function fetchModelCatalog(): Promise<ModelCatalog> {
  const perChannel = await Promise.all(MODEL_DEFINITION_CHANNELS.map(async (channel) => {
    try {
      const payload = await serviceRequest<unknown>(`/v0/management/model-definitions/${channel}`, {
        credentialId: MANAGER_CREDENTIAL
      });
      const models = record(payload)?.models;
      return { channel, models: Array.isArray(models) ? models : [] };
    } catch {
      // One unavailable channel must not cost the other seven their metadata.
      return { channel, models: [] as unknown[] };
    }
  }));

  // `owned_by` is what /v1/models reports back, so it is the key we can match on;
  // the channel name is kept too because some owners (google) span three channels.
  const qualified = new Map<string, ModelMetadata>();
  const byId = new Map<string, ModelMetadata>();
  const channels = new Map<string, ChannelModel[]>();
  for (const { channel, models } of perChannel) {
    const listing: ChannelModel[] = [];
    for (const item of models) {
      const entry = record(item);
      const id = textField(entry, "id");
      if (!entry || !id) continue;
      const metadata = readModelMetadata(entry);
      const displayName = textField(entry, "display_name", "name");
      listing.push({ id, ...(displayName ? { displayName } : {}), ...metadata });
      // A listing entry without figures still belongs on the page, but it must not
      // shadow another channel that does know this model's limits.
      if (Object.keys(metadata).length === 0) continue;
      const owner = textField(entry, "owned_by", "ownedBy");
      for (const key of owner ? [`${channel}/${id}`, `${owner}/${id}`] : [`${channel}/${id}`]) {
        if (!qualified.has(key)) qualified.set(key, metadata);
      }
      if (!byId.has(id)) byId.set(id, metadata);
    }
    if (listing.length > 0) {
      channels.set(channel, listing.sort((left, right) => left.id.localeCompare(right.id)));
    }
  }
  return {
    size: byId.size,
    channels,
    lookup: (id, ownedBy) => qualified.get(`${ownedBy.trim().toLowerCase()}/${id}`) ?? byId.get(id)
  };
}

function readModels(value: unknown, catalog?: ModelCatalog): ProxyModel[] {
  const data = record(value)?.data;
  if (!Array.isArray(data)) throw new Error("Invalid model catalog response");
  const seen = new Set<string>();
  const models: ProxyModel[] = [];
  for (const item of data) {
    const entry = record(item);
    const id = textField(entry, "id");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const ownedBy = textField(entry, "owned_by", "ownedBy") ?? "";
    models.push({ id, ownedBy, ...catalog?.lookup(id, ownedBy) });
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
    const status = textField(entry, "status");
    const statusMessage = textField(entry, "status_message");
    const email = textField(entry, "email");
    const lastRefresh = textField(entry, "last_refresh", "updated_at");
    accounts.push({
      key: `${stableId}:${index}`,
      provider,
      displayName,
      ...(deleteName ? { deleteName } : {}),
      active: entry.disabled !== true && entry.unavailable !== true,
      removable: !runtimeOnly && Boolean(deleteName),
      ...(status ? { status } : {}),
      ...(statusMessage ? { statusMessage } : {}),
      ...(email ? { email } : {}),
      ...(lastRefresh ? { lastRefresh } : {}),
      success: counter(entry.success),
      failed: counter(entry.failed),
      recentRequests: readUsageBuckets(entry.recent_requests)
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
      models: definitions.map((model) => ({
        id: model.id,
        api: config.api,
        ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
        ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
        ...(model.reasoning === undefined ? {} : { reasoning: model.reasoning })
      }))
    });
  }
}

/**
 * Reads the routable model list already enriched with upstream capabilities, and
 * hands back the catalog it used: the workspace view also needs the full
 * per-channel listing, and fetching eight channels twice would be wasteful.
 */
async function loadModels(): Promise<{ models: ProxyModel[]; catalog: ModelCatalog }> {
  const [payload, catalog] = await Promise.all([
    serviceRequest<unknown>("/v1/models", { credentialId: API_CREDENTIAL }),
    fetchModelCatalog()
  ]);
  return { models: readModels(payload, catalog), catalog };
}

return { serviceRequest, readModels, readAccounts, publishModels, fetchModelCatalog, loadModels };
}
