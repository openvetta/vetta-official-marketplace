import type { PluginNotifyOptions, SendPromptResult } from "@vetta-org/plugin-sdk";
import type { InteractionStore } from "../../domain/interaction-store";

/** Host capabilities the rendered views need; injected so components stay testable. */
export interface GenerativeUiDeps {
    sendPrompt(text: string): Promise<SendPromptResult>;
    notify(options: PluginNotifyOptions): void;
    interactions: InteractionStore;
}
