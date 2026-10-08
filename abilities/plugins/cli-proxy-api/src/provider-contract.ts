export type OAuthProviderId = "gemini-cli" | "codex" | "claude" | "antigravity" | "kimi" | "xai" | "meta" | "devin" | "kimi-ai";
export type ProtocolGroup = "google" | "anthropic" | "responses" | "completions";

export interface OAuthProviderDefinition {
  id: OAuthProviderId;
  authPath: string;
  deviceFlow: boolean;
}

export const OAUTH_PROVIDERS: readonly OAuthProviderDefinition[] = [
  { id: "gemini-cli", authPath: "/v8/management/oauth/auth-url?provider=gemini-cli", deviceFlow: false },
  { id: "codex", authPath: "/v8/management/oauth/auth-url?provider=codex&is_webui=true", deviceFlow: false },
  { id: "claude", authPath: "/v8/management/oauth/auth-url?provider=claude&is_webui=true", deviceFlow: false },
  { id: "antigravity", authPath: "/v8/management/oauth/auth-url?provider=antigravity&is_webui=true", deviceFlow: false },
  { id: "kimi", authPath: "/v8/management/oauth/auth-url?provider=kimi", deviceFlow: true },
  { id: "xai", authPath: "/v8/management/oauth/auth-url?provider=xai", deviceFlow: true },
  { id: "meta", authPath: "/v8/management/oauth/auth-url?provider=meta", deviceFlow: true },
  { id: "devin", authPath: "/v8/management/oauth/auth-url?provider=devin", deviceFlow: false },
  { id: "kimi-ai", authPath: "/v8/management/oauth/auth-url?provider=kimi-ai", deviceFlow: true }
] as const;

/** Every protocol group, in the order providers are published. */
export const PROTOCOL_GROUPS = ["google", "anthropic", "responses", "completions"] as const satisfies readonly ProtocolGroup[];

export function isProtocolGroup(value: string): value is ProtocolGroup {
  return (PROTOCOL_GROUPS as readonly string[]).includes(value);
}

export function protocolGroupFor(owner: string, modelId: string): ProtocolGroup {
  const source = owner.trim().toLowerCase();
  if (source === "antigravity" && /claude|anthropic/u.test(modelId.toLowerCase())) return "anthropic";
  if (["gemini-cli", "gemini", "google", "vertex", "antigravity", "aistudio"].includes(source)) return "google";
  if (["claude", "anthropic", "kimi", "kimi-ai"].includes(source)) return "anthropic";
  if (["codex", "openai"].includes(source)) return "responses";
  return "completions";
}

/**
 * Channels accepted by `/v8/management/routing/model-definitions/:channel`.
 *
 * The route is keyed by upstream **channel**, not by the `owned_by` value that
 * `/v1/models` reports, and the runtime answers `{"error":"unknown channel"}`
 * for anything else — `gemini-cli`, `google`, `openai` and `anthropic` are all
 * rejected even though they appear as owners. Kept in channel order so catalog
 * merging stays deterministic.
 */
export const MODEL_DEFINITION_CHANNELS = [
  "antigravity", "aistudio", "claude", "codex", "gemini", "kimi", "vertex", "xai", "meta", "devin", "kimi-ai"
] as const;

/**
 * Which model-definition channel backs each OAuth provider, so a connected
 * account can be shown with the models its channel actually routes. Gemini CLI
 * authenticates the `gemini` channel — the route has no `gemini-cli` key.
 */
export const MODEL_CHANNEL_BY_PROVIDER: Record<OAuthProviderId, string> = {
  "gemini-cli": "gemini",
  codex: "codex",
  claude: "claude",
  antigravity: "antigravity",
  kimi: "kimi",
  xai: "xai",
  meta: "meta",
  devin: "devin",
  "kimi-ai": "kimi-ai"
};

/** The channel backing a credential, or `undefined` for providers this plugin does not model. */
export function modelChannelFor(provider: string): string | undefined {
  return MODEL_CHANNEL_BY_PROVIDER[provider as OAuthProviderId];
}
