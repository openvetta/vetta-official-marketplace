import type { ConversationScenario, Disposable, PluginContext } from "@vetta-org/plugin-sdk";
import { GENERATIVE_UI_SCOPES } from "../tools/tool-scopes";
import { VISUAL_ANSWER_GUIDANCE } from "./visual-answer-guidance";

const BLOCK_PRIORITY = 850;

/** Adds the guidance only where the tools exist (interactive chats); other scenarios get nothing. */
export function registerPromptProvider(ctx: PluginContext): Disposable {
    return ctx.agent.registerSystemPromptProvider({
        id: "visual-answer-guidance",
        timeoutMs: 1000,
        handler({ plugin, session }) {
            if (!GENERATIVE_UI_SCOPES.includes(session.scenario as ConversationScenario)) return [];
            return [{ type: "addBlock" as const, block: { id: `plugin.${plugin.id}.visual-answers`, content: VISUAL_ANSWER_GUIDANCE, priority: BLOCK_PRIORITY } }];
        },
    });
}
