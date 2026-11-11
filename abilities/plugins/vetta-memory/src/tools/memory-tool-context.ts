import type { MemoryRecord } from "../domain/memory-types";

export const MEMORY_TOOL_SCOPES = ["conversation", "project"] as const;

/** Tool results are previews: capped so one call can never flood the context. */
export const MAX_RESULT_CHARS = 4000;

export const MEMORY_DISABLED_RESULT = {
    ok: false,
    error: "Long-term memory is turned off on the Memory page. Tell the user if they expected it to work.",
} as const;

/** The compact shape returned to the model; never leaks storage-internal fields. */
export function toToolMemory(record: MemoryRecord) {
    return {
        id: record.id,
        content: record.content,
        kind: record.kind,
        scope: record.scope,
        pinned: record.pinned,
    };
}

export function capText(text: string, max = MAX_RESULT_CHARS): { text: string; truncated: boolean } {
    return text.length <= max ? { text, truncated: false } : { text: `${text.slice(0, max)}\n…`, truncated: true };
}
