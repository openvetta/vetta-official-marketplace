import type { PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import { dailyLines, memoryLine, scratchLine } from "../domain/memory-prompt";
import type { MemoryServices } from "../domain/memory-services";
import { dateKey, isDateKey } from "../domain/memory-text";
import { isVisibleIn } from "../domain/memory-types";
import { capText, MEMORY_DISABLED_RESULT, MEMORY_TOOL_SCOPES } from "./memory-tool-context";

interface ReadInput {
    target?: string;
    date?: string;
}

export function createMemoryReadTool(services: MemoryServices): PluginAgentToolRegistration<ReadInput> {
    return {
        id: "memory-read",
        name: "memory_read",
        label: "%tool.read.label%",
        description:
            "Read a memory file in full: target=long_term (all memories visible here), target=daily with an optional date (YYYY-MM-DD, default today), target=scratchpad (the checklist), or target=list_daily (dates that have a log). Output is capped, so use memory_search for a specific topic. Read-only.",
        parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
                target: { type: "string", enum: ["long_term", "daily", "scratchpad", "list_daily"] },
                date: { type: "string", description: "YYYY-MM-DD; only for target=daily." },
            },
            required: ["target"],
        },
        scope_use: MEMORY_TOOL_SCOPES,
        async handler({ session, trigger }) {
            await services.loadAll();
            if (!services.memories.getSettings().enabled) return MEMORY_DISABLED_RESULT;
            const input = trigger.input ?? {};
            switch (input.target) {
                case "long_term": {
                    const visible = services.memories.list().filter((record) => isVisibleIn(record, session.cwd));
                    return { ok: true, count: visible.length, ...capText(visible.map(memoryLine).join("\n")) };
                }
                case "scratchpad": {
                    const items = services.scratchpad.list(session.cwd);
                    return { ok: true, count: items.length, ...capText(items.map(scratchLine).join("\n")) };
                }
                case "list_daily":
                    return { ok: true, dates: (await services.daily.listDates()).slice(0, 60) };
                case "daily": {
                    const date = isDateKey(input.date) ? input.date : dateKey(Date.now());
                    const entries = await services.daily.readDay(date);
                    return { ok: true, date, count: entries.length, ...capText(dailyLines(entries)) };
                }
                default:
                    return { ok: false, error: "target must be long_term, daily, scratchpad or list_daily" };
            }
        },
    };
}
