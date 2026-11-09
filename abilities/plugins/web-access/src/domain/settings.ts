import { z } from "zod";
import type { FetchMode, SearchProviderChoice, SearchProviderId } from "./search-types";

export const SEARCH_PROVIDER_IDS = ["exa-mcp", "exa", "brave", "tavily", "bocha", "searxng"] as const;

export const FETCH_MODES: readonly FetchMode[] = ["auto", "direct", "jina"];

/** Secrets are keyed by the provider they authenticate. `exa-mcp` is keyless. */
export const PROVIDER_SECRET_KEYS: Record<SearchProviderId, string | null> = {
  "exa-mcp": null,
  exa: "exaApiKey",
  brave: "braveApiKey",
  tavily: "tavilyApiKey",
  bocha: "bochaApiKey",
  searxng: null
};

export const JINA_SECRET_KEY = "jinaApiKey";

export interface WebAccessSettings {
  searchProvider: SearchProviderChoice;
  resultCount: number;
  fetchMode: FetchMode;
  maxChars: number;
  searxngUrl: string;
  allowPrivateHosts: boolean;
  remoteFallback: boolean;
}

export const DEFAULT_SETTINGS: WebAccessSettings = {
  searchProvider: "auto",
  resultCount: 5,
  fetchMode: "auto",
  maxChars: 12_000,
  searxngUrl: "",
  allowPrivateHosts: false,
  remoteFallback: true
};

export const MIN_RESULT_COUNT = 1;
export const MAX_RESULT_COUNT = 10;
export const MIN_CHARS = 1_000;
export const MAX_CHARS = 50_000;

const settingsSchema = z.object({
  searchProvider: z.enum(["auto", ...SEARCH_PROVIDER_IDS]).catch(DEFAULT_SETTINGS.searchProvider),
  resultCount: z.coerce.number().int().min(MIN_RESULT_COUNT).max(MAX_RESULT_COUNT).catch(DEFAULT_SETTINGS.resultCount),
  fetchMode: z.enum(["auto", "direct", "jina"]).catch(DEFAULT_SETTINGS.fetchMode),
  maxChars: z.coerce.number().int().min(MIN_CHARS).max(MAX_CHARS).catch(DEFAULT_SETTINGS.maxChars),
  searxngUrl: z.string().catch(DEFAULT_SETTINGS.searxngUrl),
  allowPrivateHosts: z.boolean().catch(DEFAULT_SETTINGS.allowPrivateHosts),
  remoteFallback: z.boolean().catch(DEFAULT_SETTINGS.remoteFallback)
});

/**
 * Settings live in a file the user can also edit by hand, so every read goes
 * through this. Unknown or broken fields fall back one by one instead of
 * discarding the whole file.
 */
export function normalizeSettings(value: unknown): WebAccessSettings {
  const parsed = settingsSchema.safeParse(value ?? {});
  if (!parsed.success) return { ...DEFAULT_SETTINGS };
  return {
    ...parsed.data,
    searxngUrl: normalizeBaseUrl(parsed.data.searxngUrl)
  };
}

/** Accepts what users paste into the field and keeps only the origin + path. */
export function normalizeBaseUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return `${url.origin}${url.pathname.replace(/\/+$/u, "")}`;
  } catch {
    return "";
  }
}

export function isSearchProvider(value: string): value is SearchProviderId {
  return (SEARCH_PROVIDER_IDS as readonly string[]).includes(value);
}
