import { tokenize } from "./memory-text";
import { isVisibleIn, type MemoryKind, type MemoryRecord } from "./memory-types";

export interface SearchDoc<T> {
    item: T;
    text: string;
    /** Multiplier on the final score (pinned memories, labelled sources). */
    boost?: number;
    updatedAt?: number;
}

const K1 = 1.2;
const B = 0.75;

/** BM25 ranking over tokenized documents. Documents sharing no query token are dropped. */
export function rankDocs<T>(docs: readonly SearchDoc<T>[], query: string, limit: number): { item: T; score: number }[] {
    const queryTokens = [...new Set(tokenize(query))];
    if (queryTokens.length === 0 || docs.length === 0) return [];
    const tokenized = docs.map((doc) => tokenize(doc.text));
    const avgLength = tokenized.reduce((sum, tokens) => sum + tokens.length, 0) / docs.length || 1;
    const docFrequency = new Map<string, number>();
    for (const tokens of tokenized) {
        for (const token of new Set(tokens)) docFrequency.set(token, (docFrequency.get(token) ?? 0) + 1);
    }
    const now = Date.now();
    const scored: { item: T; score: number; updatedAt: number }[] = [];
    docs.forEach((doc, index) => {
        const tokens = tokenized[index];
        const counts = new Map<string, number>();
        for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
        let score = 0;
        for (const token of queryTokens) {
            const tf = counts.get(token);
            if (!tf) continue;
            const df = docFrequency.get(token) ?? 1;
            const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
            score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * tokens.length) / avgLength)));
        }
        if (score <= 0) return;
        const updatedAt = doc.updatedAt ?? 0;
        const ageDays = updatedAt ? Math.max(0, (now - updatedAt) / 86_400_000) : 365;
        scored.push({ item: doc.item, score: score * (doc.boost ?? 1) * (1 + 0.1 / (1 + ageDays / 30)), updatedAt });
    });
    return scored
        .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
        .slice(0, limit)
        .map(({ item, score }) => ({ item, score }));
}

export interface SearchOptions {
    cwd?: string | null;
    /** Ignore project visibility (management UI). */
    allProjects?: boolean;
    kind?: MemoryKind;
    limit?: number;
}

export function sortByRecency<T extends { pinned: boolean; updatedAt: number }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

/** Ranked search over long-term memories. An empty query lists pinned, then newest. */
export function searchMemories(items: readonly MemoryRecord[], query: string, options: SearchOptions = {}): MemoryRecord[] {
    const limit = options.limit ?? 10;
    const visible = items.filter(
        (item) => (options.allProjects || isVisibleIn(item, options.cwd)) && (!options.kind || item.kind === options.kind),
    );
    if (tokenize(query).length === 0) return sortByRecency(visible).slice(0, limit);
    return rankDocs(
        visible.map((item) => ({ item, text: item.content, boost: item.pinned ? 1.25 : 1, updatedAt: item.updatedAt })),
        query,
        limit,
    ).map((entry) => entry.item);
}
