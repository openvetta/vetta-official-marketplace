import { Emitter, parseJson, SerialQueue, type MemoryStorage } from "./emitter";
import { cleanContent, newId, similarity } from "./memory-text";
import {
    DEFAULT_SETTINGS,
    isMemoryKind,
    isMemoryScope,
    isMemorySource,
    isSnapshotMode,
    MAX_MEMORIES,
    type MemoryInput,
    type MemoryPatch,
    type MemoryRecord,
    type MemorySettings,
} from "./memory-types";

const MEMORIES_FILE = "memories.json";
const SETTINGS_FILE = "settings.json";
const SCHEMA_VERSION = 1;
const DUPLICATE_THRESHOLD = 0.85;

export type AddOutcome = { record: MemoryRecord; created: boolean };

export function parseMemories(raw: string | null): MemoryRecord[] {
    const items = (parseJson(raw) as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) return [];
    const records: MemoryRecord[] = [];
    for (const entry of items) {
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const content = typeof e.content === "string" ? cleanContent(e.content) : "";
        if (typeof e.id !== "string" || !content) continue;
        const wantsProject = isMemoryScope(e.scope) && e.scope === "project";
        const projectKey = wantsProject && typeof e.projectKey === "string" ? e.projectKey : null;
        records.push({
            id: e.id,
            content,
            kind: isMemoryKind(e.kind) ? e.kind : "fact",
            scope: projectKey ? "project" : "global",
            projectKey,
            pinned: e.pinned === true,
            source: isMemorySource(e.source) ? e.source : "user",
            createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
            updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : Date.now(),
        });
    }
    return records;
}

export function parseSettings(raw: string | null): MemorySettings {
    const e = (parseJson(raw) ?? {}) as Record<string, unknown>;
    const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
    const int = (value: unknown, fallback: number, min: number, max: number) =>
        typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
    return {
        enabled: bool(e.enabled, DEFAULT_SETTINGS.enabled),
        autoExtract: bool(e.autoExtract, DEFAULT_SETTINGS.autoExtract),
        sessionSummary: bool(e.sessionSummary, DEFAULT_SETTINGS.sessionSummary),
        snapshotMode: isSnapshotMode(e.snapshotMode) ? e.snapshotMode : DEFAULT_SETTINGS.snapshotMode,
        injectLimit: int(e.injectLimit, DEFAULT_SETTINGS.injectLimit, 1, 100),
        injectCharBudget: int(e.injectCharBudget, DEFAULT_SETTINGS.injectCharBudget, 200, 12_000),
        modelKey: typeof e.modelKey === "string" && e.modelKey ? e.modelKey : null,
    };
}

/** Long-term memories plus the plugin settings, persisted as two JSON files. */
export class MemoryStore extends Emitter {
    private items: MemoryRecord[] = [];
    private settings: MemorySettings = { ...DEFAULT_SETTINGS };
    private loaded: Promise<void> | null = null;
    private readonly queue = new SerialQueue();

    constructor(private readonly storage: MemoryStorage) {
        super();
    }

    load(): Promise<void> {
        this.loaded ??= (async () => {
            this.items = parseMemories(await this.storage.readFile(MEMORIES_FILE, "utf8"));
            this.settings = parseSettings(await this.storage.readFile(SETTINGS_FILE, "utf8"));
        })().catch((error: unknown) => {
            this.loaded = null;
            throw error;
        });
        return this.loaded;
    }

    /** Snapshot of all memories, newest first. */
    list(): MemoryRecord[] {
        return [...this.items].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    getSettings(): MemorySettings {
        return this.settings;
    }

    private mutate<T>(work: () => T | Promise<T>): Promise<T> {
        return this.queue.run(async () => {
            await this.load();
            return work();
        });
    }

    private async persistItems(): Promise<void> {
        await this.storage.writeFile(
            MEMORIES_FILE,
            JSON.stringify({ schemaVersion: SCHEMA_VERSION, items: this.items }, null, 2),
            "utf8",
        );
        this.changed();
    }

    /** Adds a memory, merging into a near-duplicate in the same scope instead of repeating it. */
    add(input: MemoryInput): Promise<AddOutcome> {
        return this.mutate(async () => {
            const content = cleanContent(input.content);
            if (!content) throw new Error("Memory content is empty");
            const scope = input.scope ?? "global";
            const projectKey = scope === "project" ? (input.projectKey ?? null) : null;
            if (scope === "project" && projectKey === null) {
                throw new Error("A project memory needs a project directory");
            }
            const now = Date.now();
            const twin = this.items.find(
                (item) =>
                    item.scope === scope &&
                    item.projectKey === projectKey &&
                    similarity(item.content, content) >= DUPLICATE_THRESHOLD,
            );
            if (twin) {
                twin.content = content.length >= twin.content.length ? content : twin.content;
                twin.updatedAt = now;
                twin.pinned = twin.pinned || input.pinned === true;
                if (input.kind) twin.kind = input.kind;
                await this.persistItems();
                return { record: { ...twin }, created: false };
            }
            const record: MemoryRecord = {
                id: newId("m"),
                content,
                kind: input.kind ?? "fact",
                scope,
                projectKey,
                pinned: input.pinned === true,
                source: input.source ?? "user",
                createdAt: now,
                updatedAt: now,
            };
            this.items.push(record);
            this.evictOverflow();
            await this.persistItems();
            return { record: { ...record }, created: true };
        });
    }

    private evictOverflow(): void {
        while (this.items.length > MAX_MEMORIES) {
            const victim = this.items.filter((item) => !item.pinned).sort((a, b) => a.updatedAt - b.updatedAt)[0];
            if (!victim) throw new Error(`Memory limit of ${MAX_MEMORIES} reached; unpin or delete some memories`);
            this.items = this.items.filter((item) => item.id !== victim.id);
        }
    }

    update(id: string, patch: MemoryPatch): Promise<MemoryRecord | null> {
        return this.mutate(async () => {
            const target = this.items.find((item) => item.id === id);
            if (!target) return null;
            if (patch.content !== undefined) {
                const content = cleanContent(patch.content);
                if (!content) throw new Error("Memory content is empty");
                target.content = content;
            }
            if (patch.kind) target.kind = patch.kind;
            if (patch.pinned !== undefined) target.pinned = patch.pinned;
            if (patch.scope) {
                const projectKey = patch.scope === "project" ? (patch.projectKey ?? target.projectKey) : null;
                target.scope = projectKey ? "project" : "global";
                target.projectKey = projectKey;
            }
            target.updatedAt = Date.now();
            await this.persistItems();
            return { ...target };
        });
    }

    /** Removes the memories and returns them, so callers can keep a recovery record. */
    remove(ids: readonly string[]): Promise<MemoryRecord[]> {
        return this.mutate(async () => {
            const drop = new Set(ids);
            const removed = this.items.filter((item) => drop.has(item.id));
            if (removed.length === 0) return [];
            this.items = this.items.filter((item) => !drop.has(item.id));
            await this.persistItems();
            return removed;
        });
    }

    clear(): Promise<MemoryRecord[]> {
        return this.mutate(async () => {
            const removed = this.items;
            this.items = [];
            if (removed.length > 0) await this.persistItems();
            return removed;
        });
    }

    /** Puts records back with their original ids; ids that already exist are left untouched. */
    restore(records: readonly MemoryRecord[]): Promise<number> {
        return this.mutate(async () => {
            const known = new Set(this.items.map((item) => item.id));
            const fresh = records.filter((record) => !known.has(record.id));
            if (fresh.length === 0) return 0;
            this.items.push(...fresh.map((record) => ({ ...record })));
            this.evictOverflow();
            await this.persistItems();
            return fresh.length;
        });
    }

    updateSettings(patch: Partial<MemorySettings>): Promise<MemorySettings> {
        return this.mutate(async () => {
            this.settings = parseSettings(JSON.stringify({ ...this.settings, ...patch }));
            await this.storage.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), "utf8");
            this.changed();
            return this.settings;
        });
    }
}
