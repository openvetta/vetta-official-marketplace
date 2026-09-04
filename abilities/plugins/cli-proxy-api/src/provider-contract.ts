export type OAuthProviderId = "gemini-cli" | "codex" | "claude" | "antigravity" | "kimi" | "xai";
export type ProtocolGroup = "google" | "anthropic" | "responses" | "completions";

export interface OAuthProviderDefinition {
  id: OAuthProviderId;
  authPath: string;
  deviceFlow: boolean;
}

export const OAUTH_PROVIDERS: readonly OAuthProviderDefinition[] = [
  { id: "gemini-cli", authPath: "/v0/management/gemini-cli-auth-url", deviceFlow: false },
  { id: "codex", authPath: "/v0/management/codex-auth-url?is_webui=true", deviceFlow: false },
  { id: "claude", authPath: "/v0/management/anthropic-auth-url?is_webui=true", deviceFlow: false },
  { id: "antigravity", authPath: "/v0/management/antigravity-auth-url?is_webui=true", deviceFlow: false },
  { id: "kimi", authPath: "/v0/management/kimi-auth-url", deviceFlow: true },
  { id: "xai", authPath: "/v0/management/xai-auth-url", deviceFlow: true }
] as const;

export const CONFIGURED_PROVIDER_ROUTES = [
  "/v0/management/gemini-api-key",
  "/v0/management/interactions-api-key",
  "/v0/management/claude-api-key",
  "/v0/management/codex-api-key",
  "/v0/management/xai-api-key",
  "/v0/management/vertex-api-key",
  "/v0/management/openai-compatibility",
  "/v0/management/vertex/import"
] as const;

export function protocolGroupFor(owner: string, modelId: string): ProtocolGroup {
  const source = owner.trim().toLowerCase();
  if (source === "antigravity" && /claude|anthropic/u.test(modelId.toLowerCase())) return "anthropic";
  if (["gemini-cli", "gemini", "google", "vertex", "antigravity", "aistudio"].includes(source)) return "google";
  if (["claude", "anthropic", "kimi"].includes(source)) return "anthropic";
  if (["codex", "openai"].includes(source)) return "responses";
  return "completions";
}

/**
 * Channels accepted by `/v0/management/model-definitions/:channel`.
 *
 * The route is keyed by upstream **channel**, not by the `owned_by` value that
 * `/v1/models` reports, and the runtime answers `{"error":"unknown channel"}`
 * for anything else — `gemini-cli`, `google`, `openai` and `anthropic` are all
 * rejected even though they appear as owners. Kept in channel order so catalog
 * merging stays deterministic.
 */
export const MODEL_DEFINITION_CHANNELS = [
  "antigravity", "aistudio", "claude", "codex", "gemini", "kimi", "vertex", "xai"
] as const;
