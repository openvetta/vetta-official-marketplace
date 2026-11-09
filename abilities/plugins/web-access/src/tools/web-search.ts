import type { PluginAgentHandlerContext, PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import { SEARCH_PROVIDER_IDS } from "../domain/settings";
import type { SearchProviderId } from "../domain/search-types";
import type { WebAccessStore } from "../services/settings-store";
import type { NetworkRequest } from "../services/network";
import { providerLabel, searchWeb } from "../services/search-providers";

interface WebSearchInput {
  query: string;
  count?: number;
  provider?: SearchProviderId;
  objective?: string;
}

export function createWebSearchTool(store: WebAccessStore, call: NetworkRequest): PluginAgentToolRegistration<WebSearchInput> {
  return {
    id: "web-search",
    name: "web_search",
    label: "%tool.search.label%",
    description:
      "Search the public web and get titles, URLs and snippets. Use it when the answer depends on current facts, prices, releases, news, people, or when the user asks for sources and links. Follow up with web_fetch on the best URL when snippets are not enough. Do not use it to open a URL the user already gave you — that is web_fetch — and do not use it for facts that are stable and already in the conversation or the workspace.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for. A short, specific query works best." },
        count: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Number of results. Omit to use the user's configured default."
        },
        provider: {
          type: "string",
          enum: [...SEARCH_PROVIDER_IDS],
          description: "Override the configured provider for this call. Omit unless the user asks for a specific service."
        },
        objective: {
          type: "string",
          description: "Optional one-line description of the ideal page, used by providers that rank semantically."
        }
      },
      required: ["query"]
    },
    scope_use: ["conversation", "project", "im-claw", "automation", "kb-processing", "batch", "cli"],
    timeoutMs: 90_000,
    handler: async ({ trigger }: PluginAgentHandlerContext<{ kind: "tool-call"; input: WebSearchInput }>) => {
      const input = trigger.input;
      const query = String(input.query ?? "").trim();
      if (!query) throw new Error("query is required");

      const settings = await store.ready();
      const provider = input.provider;
      const outcome = await searchWeb(
        { call, settings: provider ? { ...settings, searchProvider: provider } : settings, secret: store.secret },
        {
          query,
          count: typeof input.count === "number" ? input.count : settings.resultCount,
          objective: input.objective
        }
      );

      return {
        query: outcome.query,
        provider: outcome.provider,
        providerLabel: providerLabel(outcome.provider),
        resultCount: outcome.results.length,
        results: outcome.results.map((hit) => ({
          title: hit.title,
          url: hit.url,
          snippet: hit.snippet,
          ...(hit.published ? { published: hit.published } : {})
        })),
        ...(outcome.raw ? { unparsedAnswer: outcome.raw } : {}),
        ...(outcome.skipped.length > 0
          ? { skipped: outcome.skipped.map((item) => `${providerLabel(item.provider)}: ${item.reason}`) }
          : {}),
        next:
          outcome.results.length > 0
            ? "Read the most promising URL with web_fetch when the snippet does not answer the question."
            : outcome.raw
              ? "The provider answered in prose instead of a result list; use unparsedAnswer directly."
              : "No results. Try a shorter query, or ask the user which provider to use."
      };
    }
  };
}
