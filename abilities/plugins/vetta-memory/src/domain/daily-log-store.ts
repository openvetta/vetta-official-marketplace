import { Emitter, parseJson, SerialQueue, type MemoryStorage } from "./emitter";
import { cleanBlock, dateKey, isDateKey, newId } from "./memory-text";
import { MAX_DAILY_ENTRIES_PER_DAY, MAX_DAILY_TEXT, type DailyEntry, type DailyEntryKind } from "./memory-types";

const DIR = "daily";
const SEARCH_DAYS = 60;

function parseDay(raw: string | null): DailyEntry[] {
    const entries = (parseJson(raw) as { entries?: unknown } | null)?.entries;
    if (!Array.isArray(entries)) return [];
    const result: DailyEntry[] = [];
    for (const entry of entries) {
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        if (typeof e.id !== "string" || typeof e.text !== "string" || typeof e.at !== "number") continue;
        result.push({
            id: e.id,
            at: e.at,
            text: e.text,
            kind: e.kind === "summary" || e.kind === "handoff" ? e.kind : "note",
            cwd: typeof e.cwd === "string" ? e.cwd : null,
        });
    }
    return result.sort((a, b) => a.at - b.at);
}

/** Append-only work log, one JSON file per local day. */
export class DailyLogStore extends Emitter {
    private readonly days = new Map<string, DailyEntry[]>();
    private dates: string[] | null = null;
    private readonly queue = new SerialQueue();

    constructor(private readonly storage: MemoryStorage) {
        super();
    }

    private path(date: string): string {
        return `${DIR}/${date}.json`;
    }

    /** Dates that have a log, newest first. */
    async listDates(): Promise<string[]> {
        if (!this.dates) {
            const keys = await this.storage.list(DIR);
            this.dates = keys
                .map((key) => key.split("/").pop()?.replace(/\.json$/, ""))
                .filter(isDateKey);
        }
        return [...new Set(this.dates)].sort().reverse();
    }

    async readDay(date: string): Promise<DailyEntry[]> {
        const cached = this.days.get(date);
        if (cached) return cached.map((entry) => ({ ...entry }));
        const entries = parseDay(await this.storage.readFile(this.path(date), "utf8"));
        this.days.set(date, entries);
        return entries.map((entry) => ({ ...entry }));
    }

    /** Entries of the most recent days, oldest first, for search. */
    async readRecent(maxDays = SEARCH_DAYS): Promise<{ date: string; entry: DailyEntry }[]> {
        const dates = (await this.listDates()).slice(0, maxDays);
        const result: { date: string; entry: DailyEntry }[] = [];
        for (const date of dates) for (const entry of await this.readDay(date)) result.push({ date, entry });
        return result.sort((a, b) => a.entry.at - b.entry.at);
    }

    append(text: string, options: { kind?: DailyEntryKind; cwd?: string | null; at?: number } = {}): Promise<DailyEntry> {
        return this.queue.run(async () => {
            const clean = cleanBlock(text, MAX_DAILY_TEXT);
            if (!clean) throw new Error("Daily log entry is empty");
            const at = options.at ?? Date.now();
            const date = dateKey(at);
            const entries = await this.readDay(date);
            const entry: DailyEntry = { id: newId("d"), at, text: clean, kind: options.kind ?? "note", cwd: options.cwd ?? null };
            entries.push(entry);
            const kept = entries.slice(-MAX_DAILY_ENTRIES_PER_DAY);
            await this.persist(date, kept);
            return { ...entry };
        });
    }

    removeEntry(date: string, id: string): Promise<boolean> {
        return this.queue.run(async () => {
            const entries = await this.readDay(date);
            const kept = entries.filter((entry) => entry.id !== id);
            if (kept.length === entries.length) return false;
            await this.persist(date, kept);
            return true;
        });
    }

    private async persist(date: string, entries: DailyEntry[]): Promise<void> {
        await this.storage.writeFile(this.path(date), JSON.stringify({ schemaVersion: 1, date, entries }, null, 2), "utf8");
        this.days.set(date, entries);
        if (this.dates && !this.dates.includes(date)) this.dates.push(date);
        this.changed();
    }
}
