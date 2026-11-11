import type { PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import { scratchLine } from "../domain/memory-prompt";
import type { MemoryServices } from "../domain/memory-services";
import { MEMORY_DISABLED_RESULT, MEMORY_TOOL_SCOPES } from "./memory-tool-context";

interface ScratchpadInput {
    action?: string;
    text?: string;
    id?: string;
    scope?: string;
}

const ACTIONS = ["add", "done", "undo", "remove", "clear_done", "list"] as const;

export function createScratchpadTool(services: MemoryServices): PluginAgentToolRegistration<ScratchpadInput> {
    return {
        id: "scratchpad",
        name: "scratchpad",
        label: "%tool.scratchpad.label%",
        description:
            "Manage the user's checklist of things to come back to: unfinished work, follow-ups, reminders. Open items are shown to you at the start of every turn. action=add (text; scope=project ties it to the current working directory, default global), done / undo / remove (id), clear_done (deletes finished items), list. Do NOT use it for durable facts (memory_write) or for a plan of the current task.",
        parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
                action: { type: "string", enum: [...ACTIONS] },
                text: { type: "string", description: "For add." },
                id: { type: "string", description: "For done, undo and remove." },
                scope: { type: "string", enum: ["global", "project"], description: "For add. Default global." },
            },
            required: ["action"],
        },
        scope_use: MEMORY_TOOL_SCOPES,
        async handler({ session, trigger }) {
            await services.loadAll();
            if (!services.memories.getSettings().enabled) return MEMORY_DISABLED_RESULT;
            const input = trigger.input ?? {};
            const pad = services.scratchpad;
            const open = () => pad.list(session.cwd).map(scratchLine).join("\n");
            const needId = typeof input.id === "string" && input.id ? input.id : null;
            switch (input.action) {
                case "add": {
                    const item = await pad.add(input.text ?? "", input.scope === "project" ? session.cwd : null);
                    return { ok: true, added: item.id, list: open() };
                }
                case "done":
                case "undo": {
                    if (!needId) return { ok: false, error: "id is required" };
                    const item = await pad.setDone(needId, input.action === "done");
                    return item ? { ok: true, list: open() } : { ok: false, error: `No item with id ${needId}` };
                }
                case "remove": {
                    if (!needId) return { ok: false, error: "id is required" };
                    return (await pad.remove(needId)) ? { ok: true, list: open() } : { ok: false, error: `No item with id ${needId}` };
                }
                case "clear_done":
                    return { ok: true, cleared: await pad.clearDone(session.cwd), list: open() };
                case "list":
                    return { ok: true, list: open() };
                default:
                    return { ok: false, error: `action must be one of ${ACTIONS.join(", ")}` };
            }
        },
    };
}
