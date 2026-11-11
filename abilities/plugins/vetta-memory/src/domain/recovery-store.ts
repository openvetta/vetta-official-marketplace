import { Emitter, parseJson, SerialQueue, type MemoryStorage } from "./emitter";
import { newId } from "./memory-text";
import { MAX_RECOVERY_ENTRIES, type MemoryRecord, type RecoveryEntry, type RecoveryReason } from "./memory-types";
import { parseMemories } from "./memory-store";

const FILE = "recovery.json";

export function parseRecovery(raw: string | null): RecoveryEntry[] {
    const entries = (parseJson(raw) as { entries?: unknown } | null)?.entries;
    if (!Array.isArray(entries)) return [];
    const result: RecoveryEntry[] = [];
    for (const entry of entries) {
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        if (typeof e.id !== "string" || typeof e.deletedAt !== "number") continue;
        const records = parseMemories(JSON.stringify({ items: e.records }));
        if (records.length === 0) continue;
        result.push({
            id: e.id,
            deletedAt: e.deletedAt,
            reason: e.reason === "agent" || e.reason === "clear" ? e.reason : "user",
            records,
            restoredAt: typeof e.restoredAt === "number" ? e.restoredAt : null,
        });
    }
    return result;
}

/** Every deletion keeps a full copy, so nothing a user or the agent forgets is lost for good. */
export class RecoveryStore extends Emitter {
    private entries: RecoveryEntry[] = [];
    private loaded: Promise<void> | null = null;
    private readonly queue = new SerialQueue();

    constructor(private readonly storage: MemoryStorage) {
        super();
    }

    load(): Promise<void> {
        this.loaded ??= (async () => {
            this.entries = parseRecovery(await this.storage.readFile(FILE, "utf8"));
        })().catch((error: unknown) => {
            this.loaded = null;
            throw error;
        });
        return this.loaded;
    }

    /** Newest first. */
    list(): RecoveryEntry[] {
        return [...this.entries].sort((a, b) => b.deletedAt - a.deletedAt);
    }

    get(id: string): RecoveryEntry | undefined {
        return this.entries.find((entry) => entry.id === id);
    }

    private mutate<T>(work: () => T | Promise<T>): Promise<T> {
        return this.queue.run(async () => {
            await this.load();
            const result = await work();
            await this.storage.writeFile(FILE, JSON.stringify({ schemaVersion: 1, entries: this.entries }, null, 2), "utf8");
            this.changed();
            return result;
        });
    }

    record(records: readonly MemoryRecord[], reason: RecoveryReason): Promise<RecoveryEntry> {
        return this.mutate(() => {
            const entry: RecoveryEntry = { id: newId("r"), deletedAt: Date.now(), reason, records: [...records], restoredAt: null };
            this.entries.push(entry);
            while (this.entries.length > MAX_RECOVERY_ENTRIES) {
                const oldest = [...this.entries].sort(
                    (a, b) => Number(b.restoredAt !== null) - Number(a.restoredAt !== null) || a.deletedAt - b.deletedAt,
                )[0];
                this.entries = this.entries.filter((item) => item.id !== oldest.id);
            }
            return entry;
        });
    }

    markRestored(id: string): Promise<void> {
        return this.mutate(() => {
            const entry = this.entries.find((item) => item.id === id);
            if (entry) entry.restoredAt = Date.now();
        });
    }

    discard(id: string): Promise<boolean> {
        return this.mutate(() => {
            const before = this.entries.length;
            this.entries = this.entries.filter((item) => item.id !== id);
            return this.entries.length < before;
        });
    }
}
