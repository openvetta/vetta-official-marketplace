import type { PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import type { MemoryServices } from "../domain/memory-services";
import { MEMORY_DISABLED_RESULT, MEMORY_TOOL_SCOPES } from "./memory-tool-context";

interface RestoreInput {
    recoveryId?: string;
}

export function createMemoryRestoreTool(services: MemoryServices): PluginAgentToolRegistration<RestoreInput> {
    return {
        id: "memory-restore",
        name: "memory_restore",
        label: "%tool.restore.label%",
        description:
            "Undo a deletion by passing the recoveryId returned by memory_forget (or shown on the Memory page). Use it when the user says a memory was removed by mistake. Memories that already exist again are left untouched.",
        parameters: {
            type: "object",
            additionalProperties: false,
            properties: { recoveryId: { type: "string" } },
            required: ["recoveryId"],
        },
        scope_use: MEMORY_TOOL_SCOPES,
        async handler({ trigger }) {
            await services.loadAll();
            if (!services.memories.getSettings().enabled) return MEMORY_DISABLED_RESULT;
            const id = typeof trigger.input?.recoveryId === "string" ? trigger.input.recoveryId : "";
            if (!id) return { ok: false, error: "recoveryId is required" };
            const outcome = await services.restore(id);
            if (outcome.status === "not-found") return { ok: false, error: `No recovery record ${id}` };
            if (outcome.status === "already-restored") return { ok: false, error: "That deletion was already restored" };
            return { ok: true, restored: outcome.count };
        },
    };
}
