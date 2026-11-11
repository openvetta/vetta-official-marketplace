import type { PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import type { MemoryServices } from "../domain/memory-services";
import { isVisibleIn } from "../domain/memory-types";
import { MEMORY_DISABLED_RESULT, MEMORY_TOOL_SCOPES } from "./memory-tool-context";

interface ForgetInput {
    ids?: unknown;
}

export function createMemoryForgetTool(services: MemoryServices): PluginAgentToolRegistration<ForgetInput> {
    return {
        id: "memory-forget",
        name: "memory_forget",
        label: "%tool.forget.label%",
        description:
            "Delete long-term memories by id when the user asks you to forget something or a memory is wrong. Get ids from the injected memory list or memory_search. Only memories visible in this conversation (global or current project) can be deleted. The deletion is recoverable: the result contains a recoveryId that memory_restore accepts. Do NOT delete memories the user did not ask to remove.",
        parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
                ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 },
            },
            required: ["ids"],
        },
        scope_use: MEMORY_TOOL_SCOPES,
        async handler({ session, trigger }) {
            await services.loadAll();
            if (!services.memories.getSettings().enabled) return MEMORY_DISABLED_RESULT;
            const requested = Array.isArray(trigger.input?.ids)
                ? trigger.input.ids.filter((id): id is string => typeof id === "string")
                : [];
            if (requested.length === 0) return { ok: false, error: "ids is required" };
            const allowed = new Set(
                services.memories.list().filter((item) => isVisibleIn(item, session.cwd)).map((item) => item.id),
            );
            const { removed, recoveryId } = await services.forget(
                requested.filter((id) => allowed.has(id)),
                "agent",
            );
            return {
                ok: true,
                removed: removed.length,
                recoveryId,
                notFound: requested.filter((id) => !allowed.has(id)),
                deleted: removed.map((record) => record.content),
            };
        },
    };
}
