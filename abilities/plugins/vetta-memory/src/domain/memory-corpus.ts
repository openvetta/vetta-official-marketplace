import { rankDocs, type SearchDoc } from "./memory-search";
import { isVisibleIn, type MemoryKind } from "./memory-types";
import type { MemoryServices } from "./memory-services";

export type HitSource = "memory" | "daily" | "scratchpad";

export interface SearchHit {
    source: HitSource;
    id: string;
    text: string;
    score: number;
    kind?: string;
    date?: string;
    done?: boolean;
}

export interface CorpusOptions {
    cwd?: string | null;
    limit?: number;
    sources?: readonly HitSource[];
    kind?: MemoryKind;
}

/** One ranked keyword search across long-term memories, daily logs and the scratchpad. */
export async function searchCorpus(services: MemoryServices, query: string, options: CorpusOptions = {}): Promise<SearchHit[]> {
    const wanted = new Set<HitSource>(options.sources?.length ? options.sources : ["memory", "daily", "scratchpad"]);
    await services.loadAll();
    const docs: SearchDoc<Omit<SearchHit, "score">>[] = [];
    if (wanted.has("memory")) {
        for (const record of services.memories.list()) {
            if (!isVisibleIn(record, options.cwd) || (options.kind && record.kind !== options.kind)) continue;
            docs.push({
                item: { source: "memory", id: record.id, text: record.content, kind: record.kind },
                text: record.content,
                boost: record.pinned ? 1.25 : 1,
                updatedAt: record.updatedAt,
            });
        }
    }
    if (wanted.has("daily") && !options.kind) {
        for (const { date, entry } of await services.daily.readRecent()) {
            docs.push({
                item: { source: "daily", id: entry.id, text: entry.text, kind: entry.kind, date },
                text: entry.text,
                boost: 0.85,
                updatedAt: entry.at,
            });
        }
    }
    if (wanted.has("scratchpad") && !options.kind) {
        for (const item of services.scratchpad.list(options.cwd)) {
            docs.push({
                item: { source: "scratchpad", id: item.id, text: item.text, done: item.done },
                text: item.text,
                boost: 0.9,
                updatedAt: item.createdAt,
            });
        }
    }
    return rankDocs(docs, query, options.limit ?? 10).map(({ item, score }) => ({ ...item, score }));
}
