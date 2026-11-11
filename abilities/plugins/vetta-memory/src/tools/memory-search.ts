import type { PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import { searchCorpus, type HitSource } from "../domain/memory-corpus";
import type { MemoryServices } from "../domain/memory-services";
import { isMemoryKind, MEMORY_KINDS } from "../domain/memory-types";
import { MEMORY_DISABLED_RESULT, MEMORY_TOOL_SCOPES } from "./memory-tool-context";

interface SearchInput {
    query?: string;
    kind?: string;
    sources?: unknown;
    limit?: number;
}

const SOURCES: readonly HitSource[] = ["memory", "daily", "scratchpad"];

export function createMemorySearchTool(services: MemoryServices): PluginAgentToolRegistration<SearchInput> {
    return {
        id: "memory-search",
        name: "memory_search",
        label: "%tool.search.label%",
        description:
            "Keyword search across the user's long-term memories, the daily logs of the last 60 days and the scratchpad (global items plus those of the current project). Matches words, #tags and [[links]]; if the first try finds nothing, rephrase with other keywords. Use it when the injected memory list may not include what you need, or to get an id before correcting or forgetting a memory. An empty query lists the newest long-term memories. Read-only.",
        parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
                query: { type: "string", description: "Keywords, #tags or [[links]]. Leave empty to list recent long-term memories." },
                sources: { type: "array", items: { type: "string", enum: [...SOURCES] }, description: "Limit the search; default all three." },
                kind: { type: "string", enum: [...MEMORY_KINDS], description: "Only long-term memories of this kind." },
                limit: { type: "integer", minimum: 1, maximum: 30, description: "Default 10." },
            },
        },
        scope_use: MEMORY_TOOL_SCOPES,
        async handler({ session, trigger }) {
            await services.loadAll();
            if (!services.memories.getSettings().enabled) return MEMORY_DISABLED_RESULT;
            const input = trigger.input ?? {};
            const limit = Math.min(30, Math.max(1, Math.round(Number(input.limit) || 10)));
            const query = typeof input.query === "string" ? input.query : "";
            const sources = Array.isArray(input.sources)
                ? input.sources.filter((source): source is HitSource => SOURCES.includes(source as HitSource))
                : [];
            const kind = isMemoryKind(input.kind) ? input.kind : undefined;
            if (!query.trim()) {
                const recent = services.memories
                    .list()
                    .filter((record) => record.scope === "global" || record.projectKey === session.cwd)
                    .filter((record) => !kind || record.kind === kind)
                    .slice(0, limit);
                return {
                    ok: true,
                    count: recent.length,
                    results: recent.map((record) => ({ source: "memory", id: record.id, text: record.content, kind: record.kind })),
                };
            }
            const hits = await searchCorpus(services, query, { cwd: session.cwd, limit, sources, kind });
            return {
                ok: true,
                count: hits.length,
                results: hits.map(({ score: _score, ...hit }) => hit),
                ...(hits.length === 0 ? { hint: "No matches. Try different keywords or a #tag." } : {}),
            };
        },
    };
}
