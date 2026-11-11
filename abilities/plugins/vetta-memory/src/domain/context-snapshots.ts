import { dateKey } from "./memory-text";
import type { SnapshotMode } from "./memory-types";

interface Snapshot {
    text: string;
    day: string;
    revision: number;
}

const MAX_SESSIONS = 50;

/**
 * Keeps the injected memory block byte-identical between deliberate
 * checkpoints. Prefix-caching runtimes invalidate everything after the first
 * changed token, so a block that shifts every turn would force the whole
 * conversation to be reprocessed. A snapshot is rebuilt when
 *  - the session has none yet (session start),
 *  - long-term memory or settings changed (`revision`),
 *  - the local day rolled over,
 *  - or a checkpoint such as context compaction invalidated it.
 * In `per-turn` mode every call rebuilds.
 */
export class ContextSnapshots {
    private readonly entries = new Map<string, Snapshot>();

    async get(
        sessionId: string,
        mode: SnapshotMode,
        revision: number,
        now: number,
        build: () => Promise<string>,
    ): Promise<string> {
        const day = dateKey(now);
        const cached = this.entries.get(sessionId);
        if (mode === "stable" && cached && cached.day === day && cached.revision === revision) return cached.text;
        const text = await build();
        this.entries.delete(sessionId);
        this.entries.set(sessionId, { text, day, revision });
        while (this.entries.size > MAX_SESSIONS) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined) break;
            this.entries.delete(oldest);
        }
        return text;
    }

    invalidate(sessionId: string): void {
        this.entries.delete(sessionId);
    }

    clear(): void {
        this.entries.clear();
    }
}
