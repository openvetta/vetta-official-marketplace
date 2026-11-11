import type { Disposable, PluginContext } from "@vetta-org/plugin-sdk";
import { collectContext } from "../domain/memory-context";
import { MEMORY_BLOCK_PRIORITY } from "../domain/memory-prompt";
import type { MemoryServices } from "../domain/memory-services";

/**
 * Injects the memory block at the start of every Agent turn. In `stable` mode
 * the block comes from a per-session snapshot, so it stays byte-identical
 * between checkpoints and does not defeat prefix caching.
 */
export function registerPromptProvider(ctx: PluginContext, services: MemoryServices): Disposable {
    return ctx.agent.registerSystemPromptProvider({
        id: "memory-context",
        timeoutMs: 3000,
        context: { conversation: "messages" },
        async handler({ plugin, session, conversation, trigger }) {
            await services.loadAll();
            const settings = services.memories.getSettings();
            if (!settings.enabled) return [];
            const latestUser = [...conversation.messages].reverse().find((message) => message.role === "user");
            const content = await services.snapshots.get(
                session.id,
                settings.snapshotMode,
                services.memories.revision,
                trigger.timestamp,
                () => collectContext(services, session.cwd, latestUser?.text ?? "", trigger.timestamp),
            );
            return [
                {
                    type: "addBlock" as const,
                    block: { id: `plugin.${plugin.id}.memory`, content, priority: MEMORY_BLOCK_PRIORITY },
                },
            ];
        },
    });
}
