/** A search provider the plugin can talk to. */
export type SearchProviderId = "exa-mcp" | "exa" | "brave" | "tavily" | "bocha" | "searxng";

/** `auto` walks the configured providers in preference order and ends at the free one. */
export type SearchProviderChoice = SearchProviderId | "auto";

export type FetchMode = "auto" | "direct" | "jina";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

export interface SkippedProvider {
  provider: SearchProviderId;
  reason: string;
}

export interface SearchOutcome {
  provider: SearchProviderId;
  query: string;
  results: SearchHit[];
  /** Providers that were considered but could not answer, in the order they were tried. */
  skipped: SkippedProvider[];
  /** Unparsed answer text, kept when a provider returns prose instead of a result list. */
  raw?: string;
}

export interface FetchOutcome {
  url: string;
  finalUrl: string;
  title: string;
  /** Who produced the readable content. */
  reader: "direct" | "exa" | "jina";
  content: string;
  truncated: boolean;
  chars: number;
}

export interface SearchRequest {
  query: string;
  count: number;
  /** Extra context for providers that accept a natural-language objective (Exa). */
  objective?: string;
}
