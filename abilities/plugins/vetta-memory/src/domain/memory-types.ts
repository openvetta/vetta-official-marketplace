export const MEMORY_KINDS = ["preference", "fact", "decision", "lesson", "project", "feedback"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_SCOPES = ["global", "project"] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export const MEMORY_SOURCES = ["user", "agent", "auto"] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const SNAPSHOT_MODES = ["stable", "per-turn"] as const;
export type SnapshotMode = (typeof SNAPSHOT_MODES)[number];

export const MAX_MEMORY_CONTENT = 500;
export const MAX_MEMORIES = 500;
export const MAX_DAILY_TEXT = 2000;
export const MAX_DAILY_ENTRIES_PER_DAY = 200;
export const MAX_SCRATCH_ITEMS = 200;
export const MAX_RECOVERY_ENTRIES = 30;

export interface MemoryRecord {
    id: string;
    content: string;
    kind: MemoryKind;
    scope: MemoryScope;
    /** Working directory the memory belongs to. `null` for global memories. */
    projectKey: string | null;
    pinned: boolean;
    source: MemorySource;
    createdAt: number;
    updatedAt: number;
}

export interface MemoryInput {
    content: string;
    kind?: MemoryKind;
    scope?: MemoryScope;
    projectKey?: string | null;
    pinned?: boolean;
    source?: MemorySource;
}

export type MemoryPatch = Partial<Pick<MemoryRecord, "content" | "kind" | "scope" | "projectKey" | "pinned">>;

export type DailyEntryKind = "note" | "summary" | "handoff";

export interface DailyEntry {
    id: string;
    at: number;
    text: string;
    kind: DailyEntryKind;
    cwd: string | null;
}

export interface ScratchItem {
    id: string;
    text: string;
    done: boolean;
    /** `null` = visible everywhere. */
    projectKey: string | null;
    createdAt: number;
    doneAt: number | null;
}

export type RecoveryReason = "agent" | "user" | "clear";

export interface RecoveryEntry {
    id: string;
    deletedAt: number;
    reason: RecoveryReason;
    records: MemoryRecord[];
    restoredAt: number | null;
}

export interface MemorySettings {
    /** Master switch: inject memory into the prompt and enable the tools. */
    enabled: boolean;
    /** Extract memories from finished turns with the user's configured model. */
    autoExtract: boolean;
    /** Write a short session summary to the daily log when a session ends. */
    sessionSummary: boolean;
    /** `stable` keeps the injected block byte-identical between checkpoints (prefix-cache friendly). */
    snapshotMode: SnapshotMode;
    /** Max long-term memories injected into one turn. */
    injectLimit: number;
    /** Max characters of long-term memory text injected into one turn. */
    injectCharBudget: number;
    /** `provider/model` used for extraction and summaries; `null` = the host default model. */
    modelKey: string | null;
}

export const DEFAULT_SETTINGS: MemorySettings = {
    enabled: true,
    autoExtract: false,
    sessionSummary: true,
    snapshotMode: "stable",
    injectLimit: 30,
    injectCharBudget: 4000,
    modelKey: null,
};

function oneOf<T extends string>(list: readonly T[]) {
    return (value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);
}

export const isMemoryKind = oneOf(MEMORY_KINDS);
export const isMemoryScope = oneOf(MEMORY_SCOPES);
export const isMemorySource = oneOf(MEMORY_SOURCES);
export const isSnapshotMode = oneOf(SNAPSHOT_MODES);

/** A project-scoped item is visible in a session when it is global or belongs to that project. */
export function isVisibleIn(item: { projectKey: string | null }, cwd: string | null | undefined): boolean {
    return item.projectKey === null || (cwd != null && item.projectKey === cwd);
}
