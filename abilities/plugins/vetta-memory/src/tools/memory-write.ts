import type { PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import type { MemoryServices } from "../domain/memory-services";
import { looksSensitive } from "../domain/memory-text";
import { isMemoryKind, isMemoryScope, MEMORY_KINDS, MEMORY_SCOPES } from "../domain/memory-types";
import { MEMORY_DISABLED_RESULT, MEMORY_TOOL_SCOPES, toToolMemory } from "./memory-tool-context";

interface WriteInput {
    content?: string;
    target?: string;
    kind?: string;
    scope?: string;
    pinned?: boolean;
    id?: string;
}

export function createMemoryWriteTool(services: MemoryServices): PluginAgentToolRegistration<WriteInput> {
    return {
        id: "memory-write",
        name: "memory_write",
        label: "%tool.write.label%",
        description:
            "Write to the user's persistent memory. target=long_term (default) saves one durable fact that stays available in every future conversation: a lasting preference, personal or team fact, decision, convention or lesson, or something the user asked you to remember. target=daily appends a note to today's log: what was done or decided today. Pass `id` of an existing long_term memory to correct it instead of adding a duplicate. Use #tags and [[links]] inside content to make it easier to find. Do NOT store secrets or credentials, one-off task details, or anything the user did not intend to persist.",
        parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
                content: { type: "string", description: "One short, self-contained sentence in the user's language (a few lines for a daily note)." },
                target: { type: "string", enum: ["long_term", "daily"], description: "Default long_term." },
                kind: { type: "string", enum: [...MEMORY_KINDS], description: "long_term only. Default fact; feedback = how the user wants you to behave." },
                scope: { type: "string", enum: [...MEMORY_SCOPES], description: "long_term only. global (default) or project: only applies to the current working directory." },
                pinned: { type: "boolean", description: "long_term only. Always inject this memory. Use sparingly." },
                id: { type: "string", description: "long_term only. Id of an existing memory to replace with `content`." },
            },
            required: ["content"],
        },
        scope_use: MEMORY_TOOL_SCOPES,
        async handler({ session, trigger }) {
            await services.loadAll();
            if (!services.memories.getSettings().enabled) return MEMORY_DISABLED_RESULT;
            const input = trigger.input;
            const content = typeof input.content === "string" ? input.content : "";
            if (!content.trim()) return { ok: false, error: "content is required" };
            if (looksSensitive(content)) {
                return { ok: false, error: "This looks like a secret or credential, so it was not saved." };
            }

            if (input.target === "daily") {
                const entry = await services.daily.append(content, { kind: "note", cwd: session.cwd });
                return { ok: true, action: "logged", entry: { id: entry.id, text: entry.text } };
            }

            const kind = isMemoryKind(input.kind) ? input.kind : undefined;
            const scope = isMemoryScope(input.scope) ? input.scope : "global";
            if (typeof input.id === "string" && input.id) {
                const updated = await services.memories.update(input.id, {
                    content,
                    ...(kind ? { kind } : {}),
                    ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
                });
                if (!updated) return { ok: false, error: `No memory with id ${input.id}` };
                return { ok: true, action: "updated", memory: toToolMemory(updated) };
            }
            const { record, created } = await services.memories.add({
                content,
                kind,
                scope,
                projectKey: scope === "project" ? session.cwd : null,
                pinned: input.pinned === true,
                source: "agent",
            });
            return { ok: true, action: created ? "created" : "merged-with-existing", memory: toToolMemory(record) };
        },
    };
}
