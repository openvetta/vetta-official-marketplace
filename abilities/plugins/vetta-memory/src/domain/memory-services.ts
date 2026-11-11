import { ContextSnapshots } from "./context-snapshots";
import { DailyLogStore } from "./daily-log-store";
import type { MemoryStorage } from "./emitter";
import { MemoryStore } from "./memory-store";
import type { MemoryRecord, RecoveryReason } from "./memory-types";
import { RecoveryStore } from "./recovery-store";
import { ScratchpadStore } from "./scratchpad-store";

export type RestoreOutcome =
    | { status: "restored"; count: number }
    | { status: "already-restored" }
    | { status: "not-found" };

/** Everything the plugin persists, behind one handle shared by tools, hooks and UI. */
export class MemoryServices {
    readonly memories: MemoryStore;
    readonly scratchpad: ScratchpadStore;
    readonly daily: DailyLogStore;
    readonly recovery: RecoveryStore;
    readonly snapshots = new ContextSnapshots();
    private loading: Promise<void> | null = null;

    constructor(storage: MemoryStorage) {
        this.memories = new MemoryStore(storage);
        this.scratchpad = new ScratchpadStore(storage);
        this.daily = new DailyLogStore(storage);
        this.recovery = new RecoveryStore(storage);
    }

    loadAll(): Promise<void> {
        this.loading ??= Promise.all([this.memories.load(), this.scratchpad.load(), this.recovery.load()])
            .then(() => undefined)
            .catch((error: unknown) => {
                this.loading = null;
                throw error;
            });
        return this.loading;
    }

    /** Changes whenever any store changes; a cheap snapshot for `useSyncExternalStore`. */
    get revision(): number {
        return this.memories.revision + this.scratchpad.revision + this.daily.revision + this.recovery.revision;
    }

    subscribe(listener: () => void): () => void {
        const stops = [this.memories, this.scratchpad, this.daily, this.recovery].map((store) => store.subscribe(listener));
        return () => {
            for (const stop of stops) stop();
        };
    }

    /** Deletes memories after saving a recovery copy; `recoveryId` is `null` when nothing matched. */
    async forget(ids: readonly string[], reason: RecoveryReason): Promise<{ removed: MemoryRecord[]; recoveryId: string | null }> {
        await this.loadAll();
        const wanted = new Set(ids);
        const existing = this.memories.list().filter((record) => wanted.has(record.id));
        if (existing.length === 0) return { removed: [], recoveryId: null };
        const entry = await this.recovery.record(existing, reason);
        const removed = await this.memories.remove(existing.map((record) => record.id));
        return { removed, recoveryId: entry.id };
    }

    async clearAllMemories(): Promise<number> {
        await this.loadAll();
        return (await this.forget(this.memories.list().map((record) => record.id), "clear")).removed.length;
    }

    async restore(recoveryId: string): Promise<RestoreOutcome> {
        await this.loadAll();
        const entry = this.recovery.get(recoveryId);
        if (!entry) return { status: "not-found" };
        if (entry.restoredAt !== null) return { status: "already-restored" };
        const count = await this.memories.restore(entry.records);
        await this.recovery.markRestored(recoveryId);
        return { status: "restored", count };
    }
}
