import type { PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import type { MemoryServices } from "../domain/memory-services";
import { isVisibleIn } from "../domain/memory-types";
import { MEMORY_TOOL_SCOPES } from "./memory-tool-context";

export function createMemoryStatusTool(services: MemoryServices): PluginAgentToolRegistration<Record<string, never>> {
    return {
        id: "memory-status",
        name: "memory_status",
        label: "%tool.status.label%",
        description:
            "Health check of the memory system: whether it is enabled, how many memories, daily logs, scratchpad items and recoverable deletions exist, and the active settings. Use it when memory seems to be missing or misbehaving. Read-only.",
        parameters: { type: "object", additionalProperties: false, properties: {} },
        scope_use: MEMORY_TOOL_SCOPES,
        async handler({ session }) {
            await services.loadAll();
            const settings = services.memories.getSettings();
            const memories = services.memories.list();
            const items = services.scratchpad.list(session.cwd);
            return {
                ok: true,
                enabled: settings.enabled,
                longTerm: {
                    total: memories.length,
                    visibleHere: memories.filter((record) => isVisibleIn(record, session.cwd)).length,
                    pinned: memories.filter((record) => record.pinned).length,
                },
                dailyLogDays: (await services.daily.listDates()).length,
                scratchpad: { open: items.filter((item) => !item.done).length, done: items.filter((item) => item.done).length },
                recoverableDeletions: services.recovery.list().filter((entry) => entry.restoredAt === null).length,
                settings: {
                    snapshotMode: settings.snapshotMode,
                    autoExtract: settings.autoExtract,
                    sessionSummary: settings.sessionSummary,
                    injectLimit: settings.injectLimit,
                    injectCharBudget: settings.injectCharBudget,
                    model: settings.modelKey ?? "default",
                },
                search: "keyword (BM25 over words, #tags and [[links]]); no semantic search",
            };
        },
    };
}
