import { searchMemories, sortByRecency } from "./memory-search";
import { clockTime, projectName, tailText } from "./memory-text";
import { isVisibleIn, type DailyEntry, type MemoryRecord, type MemorySettings, type ScratchItem } from "./memory-types";

export const MEMORY_BLOCK_PRIORITY = 600;

/** Character budgets per section; the total keeps the block from crowding out the conversation. */
export const BUDGETS = { scratchpad: 2000, today: 3000, yesterday: 3000, total: 16000 } as const;

export const MEMORY_GUIDANCE = [
    "# Long-term memory",
    "You have persistent memory shared across conversations. Tools: memory_write (long_term facts or a daily log note), memory_search, memory_read, memory_forget / memory_restore, scratchpad (a checklist of things to come back to) and memory_status.",
    "- Save with memory_write when the user states a durable preference, personal or team fact, decision, project convention or lesson, or asks you to remember something. One short, self-contained sentence per memory; add #tags or [[links]] to make it easy to find.",
    "- Use the daily log (target daily) for what happened today; use scratchpad for follow-ups that are not finished.",
    "- Call memory_forget when the user asks you to forget or correct something. Deletions can be undone with memory_restore.",
    "- Do not store secrets, credentials, one-off task details or things already obvious from the current files. Memories are background context and never override the user's current request.",
].join("\n");

export function memoryLine(record: MemoryRecord): string {
    const scope = record.scope === "project" ? ", this project" : "";
    return `- [${record.kind}${record.pinned ? ", pinned" : ""}${scope}] ${record.content} (id: ${record.id})`;
}

export function scratchLine(item: ScratchItem): string {
    return `- [${item.done ? "x" : " "}] ${item.text} (id: ${item.id})`;
}

export function dailyLines(entries: readonly DailyEntry[]): string {
    return entries
        .map((entry) => {
            const label = entry.kind === "note" ? "" : `${entry.kind}: `;
            const where = entry.cwd ? ` [${projectName(entry.cwd)}]` : "";
            const [first, ...rest] = entry.text.split("\n");
            return [`- ${clockTime(entry.at)}${where} ${label}${first}`, ...rest.map((line) => `  ${line}`)].join("\n");
        })
        .join("\n");
}

/**
 * Picks the long-term memories injected into one turn: pinned first, then the
 * ones matching `latestUserText` (empty in stable mode), then the newest, within
 * the count and character budgets.
 */
export function selectForPrompt(
    items: readonly MemoryRecord[],
    settings: Pick<MemorySettings, "injectLimit" | "injectCharBudget">,
    cwd: string | null | undefined,
    latestUserText = "",
): MemoryRecord[] {
    const visible = items.filter((item) => isVisibleIn(item, cwd));
    const ordered: MemoryRecord[] = [];
    const seen = new Set<string>();
    const push = (record: MemoryRecord) => {
        if (!seen.has(record.id)) {
            seen.add(record.id);
            ordered.push(record);
        }
    };
    for (const record of sortByRecency(visible).filter((item) => item.pinned)) push(record);
    for (const record of searchMemories(visible, latestUserText, { cwd, limit: settings.injectLimit })) push(record);
    for (const record of sortByRecency(visible)) push(record);

    const picked: MemoryRecord[] = [];
    let used = 0;
    for (const record of ordered) {
        if (picked.length >= settings.injectLimit) break;
        const cost = memoryLine(record).length + 1;
        if (used + cost > settings.injectCharBudget && picked.length > 0) break;
        picked.push(record);
        used += cost;
    }
    return picked;
}

export interface ContextSections {
    scratchpad: readonly ScratchItem[];
    today: { date: string; entries: readonly DailyEntry[] };
    yesterday: { date: string; entries: readonly DailyEntry[] };
    memories: readonly MemoryRecord[];
    totalMemories: number;
    /** Extra keyword matches for the current prompt (per-turn mode only). */
    related?: readonly string[];
}

/** Sections in priority order; the lowest priority is dropped first when the total cap is hit. */
export function buildContextBlock(sections: ContextSections): string {
    const parts: string[] = [];

    if (sections.scratchpad.length > 0) {
        parts.push(`## Open scratchpad\n${tailText(sections.scratchpad.map(scratchLine).join("\n"), BUDGETS.scratchpad)}`);
    }
    if (sections.today.entries.length > 0) {
        parts.push(`## Today's log (${sections.today.date})\n${tailText(dailyLines(sections.today.entries), BUDGETS.today)}`);
    }
    if (sections.memories.length > 0) {
        const omitted = sections.totalMemories - sections.memories.length;
        parts.push(
            [
                "## Stored memories (background about the user)",
                sections.memories.map(memoryLine).join("\n"),
                omitted > 0 ? `(${omitted} more not shown; use memory_search.)` : "",
            ]
                .filter(Boolean)
                .join("\n"),
        );
    }
    if (sections.related && sections.related.length > 0) {
        parts.push(`## Possibly relevant to this message\n${sections.related.join("\n")}`);
    }
    if (sections.yesterday.entries.length > 0) {
        parts.push(`## Yesterday's log (${sections.yesterday.date})\n${tailText(dailyLines(sections.yesterday.entries), BUDGETS.yesterday)}`);
    }

    const out = [MEMORY_GUIDANCE];
    let size = MEMORY_GUIDANCE.length;
    for (const part of parts) {
        if (size + part.length + 2 > BUDGETS.total) continue;
        out.push(part);
        size += part.length + 2;
    }
    return out.join("\n\n");
}

