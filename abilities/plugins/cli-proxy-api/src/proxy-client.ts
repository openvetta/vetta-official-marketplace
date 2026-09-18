import { MODEL_DEFINITION_CHANNELS, isProtocolGroup, protocolGroupFor, type ProtocolGroup } from "./provider-contract";
import { reconcileModels } from "./model-reconciler";
import { selectModels, type ModelSelection } from "./model-selection";
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
export type ModelMetadata = { contextWindow?: number; maxTokens?: number; reasoning?: boolean; reasoningLevels?: string[] };
export type ProxyModel = { id: string; ownedBy: string } & ModelMetadata;

/** Fallback for older catalogs that omit structured output modalities. */
export function isImageOnlyModelId(id: string): boolean {
  return /(^gpt-image(?:-|$)|imagen|(?:^|[-_.])image(?:[-_.]|$))/iu.test(id.trim());
}

/** A model together with the protocol group it is published under. */
export type PublishedModel = ProxyModel & { group: ProtocolGroup };

/** One model as the upstream channel catalog describes it, before any account is connected. */
export type ChannelModel = { id: string; displayName?: string } & ModelMetadata;

export type ImageModelRoute = {
  id: string;
  displayName?: string;
  sourceId: string;
  sourceDisplayName: string;
  adapter: "openai-images" | "google-generate-content";
  modes: readonly ("text-to-image" | "image-to-image")[];
};

/** Resolves a model advertised by `/v1/models` to its upstream capabilities. */
export type ModelCatalog = {
  lookup(id: string, ownedBy: string): ModelMetadata | undefined;
  size: number;
  /** Everything each channel says it can route, keyed by channel name. */
  channels: ReadonlyMap<string, ChannelModel[]>;
  imageModels?: readonly ImageModelRoute[];
};

/** A ten-minute request bucket as reported by `/v0/management/auth-files`. */
export type UsageBucket = { time: string; success: number; failed: number };

/**
 * One rate-limit window the provider reports, normalised.
 *
 * Upstream states how much has been *used*; every panel that shows this reads
 * better as what is left, so the inversion happens once, here.
 */
export type QuotaWindow = {
  /** Span in minutes: 300 is a five-hour limit, 10080 a weekly one. */
  windowMinutes?: number;
  /** The provider's own wording, when it gives one. */
  label?: string;
  remainingPercent: number;
  resetAt?: string;
  resetInSeconds?: number;
};

/** Providers that meter several model families bill them against separate pools. */
export type QuotaGroup = { name?: string; description?: string; windows: QuotaWindow[] };

/** What is known about a credential's subscription and its limits. */
export type AccountQuota = {
  plan?: string;
  observedAt?: string;
  subscriptionUntil?: string;
  /** When a credential parked by a limit is due to be tried again. */
  nextRetryAfter?: string;
  credits?: { balance?: number; unlimited: boolean };
  windows: QuotaWindow[];
  /** Set instead of `windows` by providers that meter per model family. */
  groups?: QuotaGroup[];
  /** Self-serve limit resets the plan still has left. */
  resetCredits?: number;
};

export type ProxyAccount = {
  key: string;
  provider: string;
  displayName: string;
  deleteName?: string;
  active: boolean;
  removable: boolean;
  /** Distinct from `active`: only a disabled credential can be switched back on. */
  disabled: boolean;
  /** Upstream health, absent on gateways that report no counters for the credential. */
  status?: string;
  statusMessage?: string;
  email?: string;
  lastRefresh?: string;
  /** Stable runtime id; quota resets and provider probes address the credential by this. */
  authIndex?: string;
  /** Google projects the credential bills against; required to read its quota. */
  projectId?: string;
  /** Stored credential file size in bytes, as the gateway reports it. */
  size?: number;
  modifiedAt?: string;
  success: number;
  failed: number;
  recentRequests: UsageBucket[];
  /** Absent until the provider has answered at least once with limit headers. */
  quota?: AccountQuota;
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


/** Providers report limits as headers; the names carry the structure. */
function readQuota(entry: JsonRecord): AccountQuota | undefined {
  const quota = record(entry.quota);
  const signals = record(quota?.signals) ?? {};
  const idToken = record(entry.id_token);

  // `<family>-Used-Percent` anchors a window; its siblings describe the same one.
  const windows: QuotaWindow[] = [];
  for (const [key, raw] of Object.entries(signals)) {
    const match = /^(.*)-used-percent$/iu.exec(key);
    if (!match || typeof raw !== "string") continue;
    const used = Number.parseFloat(raw);
    if (!Number.isFinite(used)) continue;
    const family = match[1];
    const sibling = (suffix: string): number | undefined => {
      const value = signals[`${family}-${suffix}`];
      const parsed = typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const resetAt = sibling("Reset-At");
    const resetInSeconds = sibling("Reset-After-Seconds");
    const windowMinutes = sibling("Window-Minutes");
    windows.push({
      remainingPercent: Math.max(0, Math.min(100, 100 - used)),
      ...(windowMinutes === undefined ? {} : { windowMinutes }),
      ...(resetAt === undefined ? {} : { resetAt: new Date(resetAt * 1000).toISOString() }),
      ...(resetInSeconds === undefined ? {} : { resetInSeconds })
    });
  }
  windows.sort((left, right) => (left.windowMinutes ?? Infinity) - (right.windowMinutes ?? Infinity));

  const planSignal = Object.entries(signals).find(([key]) => /-plan-type$/iu.test(key))?.[1];
  const plan = (typeof planSignal === "string" ? planSignal : undefined) ?? textField(idToken, "plan_type");
  const unlimited = Object.entries(signals).find(([key]) => /-credits-unlimited$/iu.test(key))?.[1] === "True";
  const balanceRaw = Object.entries(signals).find(([key]) => /-credits-balance$/iu.test(key))?.[1];
  const balance = typeof balanceRaw === "string" ? Number.parseFloat(balanceRaw) : Number.NaN;
  const hasCredits = unlimited || Number.isFinite(balance);

  const observedAt = textField(quota, "observed_at");
  const subscriptionUntil = textField(idToken, "chatgpt_subscription_active_until");
  const nextRetryAfter = textField(entry, "next_retry_after");
  if (windows.length === 0 && !plan && !subscriptionUntil && !nextRetryAfter && !hasCredits) return undefined;
  return {
    windows,
    ...(plan ? { plan } : {}),
    ...(observedAt ? { observedAt } : {}),
    ...(subscriptionUntil ? { subscriptionUntil } : {}),
    ...(nextRetryAfter ? { nextRetryAfter } : {}),
    ...(hasCredits ? { credits: { unlimited, ...(Number.isFinite(balance) ? { balance } : {}) } } : {})
  };
}

/** Upstream sends `0` for "unknown"; a zero context window would fail host validation. */
export function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Reads one `/v0/management/model-definitions` entry. Absent figures stay absent. */
function readModelMetadata(entry: JsonRecord, channel: string): ModelMetadata {
  const contextWindow = positiveInteger(entry.context_length);
  const maxTokens = positiveInteger(entry.max_completion_tokens);
  const thinking = record(entry.thinking);
  // Native Google/Anthropic adapters still map Vetta levels to token budgets.
  // Only effort-based protocols can consume the gateway's raw level vocabulary.
  const group = protocolGroupFor(textField(entry, "owned_by", "ownedBy") ?? channel, textField(entry, "id") ?? "");
  const levels = group === "responses" || group === "completions" ? thinking?.levels : undefined;
  const reasoningLevels = Array.isArray(levels) && levels.length > 0 && levels.every((level) => typeof level === "string" && level.trim().length > 0)
    ? [...new Set(levels.map((level: string) => level.trim()))] : undefined;
  return {
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    // A `thinking` block is upstream's own statement that the model reasons.
    ...(thinking ? { reasoning: true } : {}),
    ...(reasoningLevels ? { reasoningLevels } : {})
  };
}

function stringList(entry: JsonRecord, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = entry[key];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function imageRoute(channel: string, entry: JsonRecord, id: string): ImageModelRoute | undefined {
  const outputs = stringList(entry, "supported_output_modalities", "supportedOutputModalities", "output_modalities")
    .map((value) => value.toLowerCase());
  if (!outputs.includes("image") && !isImageOnlyModelId(id)) return undefined;
  const inputs = stringList(entry, "supported_input_modalities", "supportedInputModalities", "input_modalities")
    .map((value) => value.toLowerCase());
  const google = ["antigravity", "aistudio", "gemini", "vertex"].includes(channel);
  const displayName = textField(entry, "display_name", "name");
  return {
    id,
    ...(displayName ? { displayName } : {}),
    sourceId: channel,
    sourceDisplayName: google ? (channel === "antigravity" ? "Google Antigravity" : "Google") : channel === "codex" ? "OpenAI Codex" : channel,
    adapter: google ? "google-generate-content" : "openai-images",
    modes: inputs.length === 0 || inputs.includes("image") ? ["text-to-image", "image-to-image"] : ["text-to-image"]
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
  const imageModels = new Map<string, ImageModelRoute>();
  for (const { channel, models } of perChannel) {
    const listing: ChannelModel[] = [];
    for (const item of models) {
      const entry = record(item);
      const id = textField(entry, "id");
      if (!entry || !id) continue;
      const image = imageRoute(channel, entry, id);
      if (image) {
        imageModels.set(`${image.sourceId}/${image.id}`, image);
        continue;
      }
      const metadata = readModelMetadata(entry, channel);
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
    imageModels: [...imageModels.values()].sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.id.localeCompare(right.id)),
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
    const ownedBy = textField(entry, "owned_by", "ownedBy") ?? "";
    if (!id || isImageOnlyModelId(id)) continue;
    const routeKey = `${protocolGroupFor(ownedBy, id)}/${id}`;
    if (seen.has(routeKey)) continue;
    seen.add(routeKey);
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
    const authIndex = textField(entry, "auth_index");
    const projectId = textField(entry, "project_id");
    const status = textField(entry, "status");
    const statusMessage = textField(entry, "status_message");
    const email = textField(entry, "email");
    const lastRefresh = textField(entry, "last_refresh", "updated_at");
    const quota = readQuota(entry);
    accounts.push({
      key: `${stableId}:${index}`,
      provider,
      displayName,
      ...(deleteName ? { deleteName } : {}),
      active: entry.disabled !== true && entry.unavailable !== true,
      disabled: entry.disabled === true,
      removable: !runtimeOnly && Boolean(deleteName),
      ...(authIndex ? { authIndex } : {}),
      ...(projectId ? { projectId } : {}),
      ...(positiveInteger(entry.size) === undefined ? {} : { size: entry.size as number }),
      ...(textField(entry, "modtime", "updated_at") ? { modifiedAt: textField(entry, "modtime", "updated_at") } : {}),
      ...(status ? { status } : {}),
      ...(statusMessage ? { statusMessage } : {}),
      ...(email ? { email } : {}),
      ...(lastRefresh ? { lastRefresh } : {}),
      success: counter(entry.success),
      failed: counter(entry.failed),
      recentRequests: readUsageBuckets(entry.recent_requests),
      ...(quota ? { quota } : {})
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

/**
 * Replaces the plugin-owned providers with exactly what is selected.
 *
 * The published set is always the whole truth. The host applies the complete
 * plugin-owned snapshot atomically, so groups that end up empty are removed in
 * the same transaction as the groups that remain.
 */
async function publishModels(
  models: readonly PublishedModel[],
  isCurrent = () => true,
  selection: ModelSelection = { mode: "all" }
): Promise<void> {
  const connection = await pluginContext.services.connection(SERVICE_ID, API_CREDENTIAL);
  if (!connection.credential) throw new Error("The managed API credential is unavailable");
  const groups = new Map<ProtocolGroup, PublishedModel[]>();
  for (const model of selectModels(models, selection)) {
    groups.set(model.group, [...(groups.get(model.group) ?? []), model]);
  }
  if (!isCurrent()) return;
  const providers = Object.fromEntries(
    (Object.keys(PROVIDER_CONFIG) as ProtocolGroup[]).flatMap((group) => {
      const definitions = groups.get(group) ?? [];
      if (definitions.length === 0) return [];
      const config = PROVIDER_CONFIG[group];
      return [[group, {
        baseUrl: `${connection.baseUrl}${config.basePath}`,
        apiKey: connection.credential,
        api: config.api,
        displayName: config.title,
        models: definitions.map((model) => ({
          id: model.id,
          api: config.api,
          ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
          ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
          ...(model.reasoning === undefined ? {} : { reasoning: model.reasoning }),
          ...(model.reasoningLevels === undefined ? {} : { reasoningLevels: [...model.reasoningLevels] })
        }))
      }]];
    })
  );
  await pluginContext.models.replaceOwnedProviders(providers);
}

async function loadImageModels(): Promise<ImageModelRoute[]> {
  const [payload, catalog] = await Promise.all([
    serviceRequest<unknown>("/v1/models", { credentialId: API_CREDENTIAL }),
    fetchModelCatalog()
  ]);
  const data = record(payload)?.data;
  if (!Array.isArray(data)) throw new Error("Invalid model catalog response");
  const routable = new Map<string, string>();
  for (const item of data) {
    const entry = record(item);
    const id = textField(entry, "id");
    if (!id) continue;
    routable.set(`${(textField(entry, "owned_by", "ownedBy") ?? "").toLowerCase()}/${id}`, id);
    routable.set(`/${id}`, id);
  }
  return (catalog.imageModels ?? []).filter((model) =>
    routable.has(`${model.sourceId.toLowerCase()}/${model.id}`) || routable.has(`/${model.id}`));
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

/**
 * What the host currently holds for this plugin, as the reconciler's baseline.
 *
 * `undefined` on a host without the read-back capability: there is nothing to
 * reconcile against, so the caller publishes what it can see and accepts that
 * an unregistered model stays missing until the next pass.
 */
async function readPublishedModels(): Promise<PublishedModel[] | undefined> {
  const read = pluginContext.models.listOwnedProviders;
  if (typeof read !== "function") return undefined;
  const providers = await read.call(pluginContext.models);
  const models: PublishedModel[] = [];
  for (const [group, provider] of Object.entries(providers)) {
    if (!isProtocolGroup(group)) continue;
    for (const model of provider.models ?? []) {
      models.push({
        id: model.id,
        // Only the group survives a publish, and the group is all the reconciler needs.
        ownedBy: "",
        group,
        ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
        ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
        ...(model.reasoning === undefined ? {} : { reasoning: model.reasoning }),
          ...(model.reasoningLevels === undefined ? {} : { reasoningLevels: [...model.reasoningLevels] })
      });
    }
  }
  return models;
}

/**
 * Everything a publish decision needs, read in one round trip and already
 * reconciled against what the host holds.
 *
 * The raw pieces come back too because the workspace view renders them: the
 * routable list is what the gateway will serve right now, while `models` is
 * what may be published without dropping a credential's models that the
 * gateway has not finished registering.
 */
async function loadPublishableModels(): Promise<{
  models: PublishedModel[];
  /** False while the gateway has not registered everything the credentials claim. */
  complete: boolean;
  routable: ProxyModel[];
  accounts: ProxyAccount[];
  catalog: ModelCatalog;
}> {
  const [{ models: routable, catalog }, accountPayload, published] = await Promise.all([
    loadModels(),
    serviceRequest<unknown>("/v0/management/auth-files", { credentialId: MANAGER_CREDENTIAL }),
    // A failed read-back must not degrade into a destructive publish: let it
    // throw so the caller retries instead of replacing the namespace blind.
    readPublishedModels()
  ]);
  const accounts = readAccounts(accountPayload);
  const { models, complete } = reconcileModels({ published, routable, accounts, catalog });
  return { models, complete, routable, accounts, catalog };
}

/** Switches one credential in or out of the routing pool. */
async function setAccountDisabled(account: ProxyAccount, disabled: boolean): Promise<void> {
  const name = account.deleteName ?? account.authIndex;
  if (!name) throw new Error("This credential cannot be switched from here");
  await serviceRequest("/v0/management/auth-files/status", {
    method: "PATCH",
    credentialId: MANAGER_CREDENTIAL,
    body: { name, disabled }
  });
}

/** Clears the quota and cooldown state that parks a credential after a rejection. */
async function resetAccountQuota(account: ProxyAccount): Promise<void> {
  if (!account.authIndex) throw new Error("This credential has no runtime index to reset");
  await serviceRequest("/v0/management/reset-quota", {
    method: "POST",
    credentialId: MANAGER_CREDENTIAL,
    body: { auth_index: account.authIndex }
  });
}

/**
 * The models one credential can actually serve.
 *
 * The channel catalog describes what a provider offers in general; this route
 * answers for the account in hand, which is what the card's model dialog claims
 * to show. Limits are filled in from the catalog because this route omits them.
 */
async function fetchAccountModels(account: ProxyAccount, catalog?: ModelCatalog): Promise<ChannelModel[]> {
  const name = account.deleteName ?? account.authIndex;
  if (!name) return [];
  const payload = await serviceRequest<unknown>(
    `/v0/management/auth-files/models?name=${encodeURIComponent(name)}`,
    { credentialId: MANAGER_CREDENTIAL }
  );
  const data = record(payload)?.models;
  if (!Array.isArray(data)) return [];
  const models: ChannelModel[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    const entry = record(item);
    const id = textField(entry, "id");
    if (!id || isImageOnlyModelId(id) || seen.has(id)) continue;
    seen.add(id);
    const displayName = textField(entry, "display_name", "name");
    const owner = textField(entry, "owned_by", "ownedBy") ?? account.provider;
    models.push({ id, ...(displayName ? { displayName } : {}), ...catalog?.lookup(id, owner) });
  }
  return models.sort((left, right) => left.id.localeCompare(right.id));
}

return {
  serviceRequest, readModels, readAccounts, publishModels, fetchModelCatalog, loadModels,
  readPublishedModels, loadPublishableModels,
  setAccountDisabled, resetAccountQuota, fetchAccountModels, loadImageModels
};
}
