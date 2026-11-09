import {
  parseBochaResults,
  parseBraveResults,
  parseExaMcpText,
  parseExaResults,
  parseSearxngResults,
  parseTavilyResults
} from "../domain/provider-responses";
import type { SearchHit, SearchOutcome, SearchProviderId, SearchRequest } from "../domain/search-types";
import { PROVIDER_SECRET_KEYS, type WebAccessSettings } from "../domain/settings";
import { exaMcpSearch } from "./exa-mcp-client";
import { expectOk, parseBody, type NetworkRequest } from "./network";

export interface SearchDependencies {
  call: NetworkRequest;
  settings: WebAccessSettings;
  secret(key: string): Promise<string | undefined>;
}

const PROVIDER_LABELS: Record<SearchProviderId, string> = {
  "exa-mcp": "Exa (free)",
  exa: "Exa",
  brave: "Brave Search",
  tavily: "Tavily",
  bocha: "Bocha",
  searxng: "SearXNG"
};

export function providerLabel(provider: SearchProviderId): string {
  return PROVIDER_LABELS[provider];
}

async function requireKey(deps: SearchDependencies, provider: SearchProviderId): Promise<string> {
  const key = PROVIDER_SECRET_KEYS[provider];
  const value = key ? (await deps.secret(key))?.trim() : "";
  if (!key || !value) {
    throw new Error(
      `${providerLabel(provider)} needs an API key. Add it under Settings → More options → Web Access, or leave the provider on Automatic to use the free search.`
    );
  }
  return value;
}

async function searchExaMcp(deps: SearchDependencies, request: SearchRequest): Promise<{ hits: SearchHit[]; raw?: string }> {
  const objective = request.objective?.trim() || `Find current, authoritative pages that answer: ${request.query}`;
  const text = await exaMcpSearch(deps.call, request.query, request.count, objective);
  return { hits: parseExaMcpText(text), raw: text };
}

async function searchExa(deps: SearchDependencies, request: SearchRequest): Promise<SearchHit[]> {
  const key = await requireKey(deps, "exa");
  const response = await expectOk(
    deps.call,
    {
      url: "https://api.exa.ai/search",
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      json: { query: request.query, numResults: request.count, type: "auto", contents: { text: { maxCharacters: 600 } } },
      responseType: "text",
      timeoutMs: 30_000
    },
    "Exa"
  );
  return parseExaResults(response.body ? parseBody(response.body) : undefined);
}

async function searchBrave(deps: SearchDependencies, request: SearchRequest): Promise<SearchHit[]> {
  const key = await requireKey(deps, "brave");
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", request.query);
  url.searchParams.set("count", String(request.count));
  const response = await expectOk(
    deps.call,
    {
      url: url.toString(),
      method: "GET",
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      responseType: "text",
      timeoutMs: 25_000
    },
    "Brave Search"
  );
  return parseBraveResults(parseBody(response.body));
}

async function searchTavily(deps: SearchDependencies, request: SearchRequest): Promise<SearchHit[]> {
  const key = await requireKey(deps, "tavily");
  const response = await expectOk(
    deps.call,
    {
      url: "https://api.tavily.com/search",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      json: { query: request.query, max_results: request.count, search_depth: "basic", include_answer: false },
      responseType: "text",
      timeoutMs: 30_000
    },
    "Tavily"
  );
  return parseTavilyResults(parseBody(response.body));
}

async function searchBocha(deps: SearchDependencies, request: SearchRequest): Promise<SearchHit[]> {
  const key = await requireKey(deps, "bocha");
  const response = await expectOk(
    deps.call,
    {
      url: "https://api.bochaai.com/v1/web-search",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      json: { query: request.query, count: request.count, summary: true },
      responseType: "text",
      timeoutMs: 30_000
    },
    "Bocha"
  );
  return parseBochaResults(parseBody(response.body));
}

async function searchSearxng(deps: SearchDependencies, request: SearchRequest): Promise<SearchHit[]> {
  const base = deps.settings.searxngUrl.trim();
  if (!base) {
    throw new Error("SearXNG needs an instance address. Add it under Settings → More options → Web Access.");
  }
  const url = new URL(`${base.replace(/\/+$/u, "")}/search`);
  url.searchParams.set("q", request.query);
  url.searchParams.set("format", "json");
  const response = await expectOk(
    deps.call,
    { url: url.toString(), method: "GET", headers: { Accept: "application/json" }, responseType: "text", timeoutMs: 30_000 },
    "SearXNG"
  );
  const hits = parseSearxngResults(parseBody(response.body));
  if (hits.length === 0 && /<html/iu.test(response.body)) {
    throw new Error("This SearXNG instance does not return JSON. Enable its JSON API, or check the address.");
  }
  return hits;
}

async function runProvider(
  provider: SearchProviderId,
  deps: SearchDependencies,
  request: SearchRequest
): Promise<{ hits: SearchHit[]; raw?: string }> {
  switch (provider) {
    case "exa-mcp":
      return searchExaMcp(deps, request);
    case "exa":
      return { hits: await searchExa(deps, request) };
    case "brave":
      return { hits: await searchBrave(deps, request) };
    case "tavily":
      return { hits: await searchTavily(deps, request) };
    case "bocha":
      return { hits: await searchBocha(deps, request) };
    case "searxng":
      return { hits: await searchSearxng(deps, request) };
  }
}

/**
 * Auto order: the user's own instances and keys first, the keyless endpoint last.
 * A provider that answers with nothing is not an answer — the chain keeps going,
 * which is what makes a misconfigured key recoverable without user action.
 */
export async function resolveAutoOrder(deps: SearchDependencies): Promise<SearchProviderId[]> {
  const order: SearchProviderId[] = [];
  if (deps.settings.searxngUrl.trim()) order.push("searxng");
  for (const provider of ["exa", "tavily", "brave", "bocha"] as const) {
    const secretKey = PROVIDER_SECRET_KEYS[provider];
    if (secretKey && (await deps.secret(secretKey))?.trim()) order.push(provider);
  }
  order.push("exa-mcp");
  return order;
}

export async function searchWeb(deps: SearchDependencies, request: SearchRequest): Promise<SearchOutcome> {
  const query = request.query.trim();
  if (!query) throw new Error("A search query is required.");
  const count = Math.min(Math.max(1, Math.floor(request.count)), 10);
  const effective: SearchRequest = { ...request, query, count };

  const choice = deps.settings.searchProvider;
  const order = choice === "auto" ? await resolveAutoOrder(deps) : [choice];
  const skipped: SearchOutcome["skipped"] = [];

  for (const provider of order) {
    try {
      const { hits, raw } = await runProvider(provider, deps, effective);
      if (hits.length > 0 || raw) {
        return { provider, query, results: hits.slice(0, count), skipped, raw: hits.length > 0 ? undefined : raw };
      }
      skipped.push({ provider, reason: "no results" });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push({ provider, reason });
      if (choice !== "auto") throw error;
    }
  }

  const detail = skipped.map((item) => `${providerLabel(item.provider)}: ${item.reason}`).join("; ");
  if (choice !== "auto") {
    throw new Error(`${providerLabel(choice)} returned no results for "${query}". ${detail}`);
  }
  throw new Error(`No search provider could answer "${query}". ${detail || "No provider is configured."}`);
}

/** Used by the settings page so a bad key reports the provider's own words. */
export async function testSearch(deps: SearchDependencies, query: string): Promise<SearchOutcome> {
  return searchWeb(deps, { query, count: 3 });
}

