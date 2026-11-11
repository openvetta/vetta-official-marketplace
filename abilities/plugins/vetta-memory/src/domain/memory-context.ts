import { searchCorpus } from "./memory-corpus";
import type { MemoryServices } from "./memory-services";
import { buildContextBlock, dailyLines, scratchLine, selectForPrompt } from "./memory-prompt";
import { clockTime, dateKey } from "./memory-text";
import { isVisibleIn } from "./memory-types";

const DAY_MS = 86_400_000;
const RELATED_LIMIT = 3;
const HANDOFF_LOG_LINES = 15;

/** Gathers every section visible from `cwd` and renders the block injected into the system prompt. */
export async function collectContext(
    services: MemoryServices,
    cwd: string | null,
    latestUserText: string,
    now: number,
): Promise<string> {
    await services.loadAll();
    const settings = services.memories.getSettings();
    const perTurn = settings.snapshotMode === "per-turn";
    const all = services.memories.list();
    const memories = selectForPrompt(all, settings, cwd, perTurn ? latestUserText : "");
    const today = dateKey(now);
    const yesterday = dateKey(now - DAY_MS);

    let related: string[] | undefined;
    if (perTurn && latestUserText.trim()) {
        const shown = new Set(memories.map((record) => record.id));
        const hits = await searchCorpus(services, latestUserText, { cwd, limit: RELATED_LIMIT + shown.size });
        related = hits
            .filter((hit) => !(hit.source === "memory" && shown.has(hit.id)))
            .slice(0, RELATED_LIMIT)
            .map((hit) => `- (${hit.source}${hit.date ? ` ${hit.date}` : ""}) ${hit.text}`);
    }

    return buildContextBlock({
        scratchpad: services.scratchpad.list(cwd).filter((item) => !item.done),
        today: { date: today, entries: await services.daily.readDay(today) },
        yesterday: { date: yesterday, entries: await services.daily.readDay(yesterday) },
        memories,
        totalMemories: all.filter((record) => isVisibleIn(record, cwd)).length,
        related,
    });
}

/** What survives context compaction: open follow-ups and the tail of today's log. `null` when there is nothing to hand off. */
export async function buildHandoff(services: MemoryServices, cwd: string | null, now: number): Promise<string | null> {
    await services.loadAll();
    const open = services.scratchpad.list(cwd).filter((item) => !item.done);
    const recent = (await services.daily.readDay(dateKey(now)))
        .filter((entry) => entry.kind !== "handoff")
        .slice(-HANDOFF_LOG_LINES);
    if (open.length === 0 && recent.length === 0) return null;
    const lines = ["Session handoff (context was compacted)."];
    if (open.length > 0) lines.push("Open scratchpad:", ...open.map(scratchLine));
    if (recent.length > 0) lines.push("Recent log:", dailyLines(recent));
    return lines.join("\n");
}

/** Plain-text rendering used by memory_read and the copy-as-markdown action. */
export function memoriesToMarkdown(records: readonly { content: string; kind: string; scope: string; pinned: boolean; updatedAt: number }[]): string {
    return records
        .map((record) => {
            const stamp = `${dateKey(record.updatedAt)} ${clockTime(record.updatedAt)}`;
            return `- #${record.kind}${record.pinned ? " #pinned" : ""} ${record.content} <!-- ${stamp}${record.scope === "project" ? ", project" : ""} -->`;
        })
        .join("\n");
}

