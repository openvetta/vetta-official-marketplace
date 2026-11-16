import { definePlugin, type PluginToolCallSlotProps } from "@vetta-org/plugin-sdk";
import { InteractionStore } from "./domain/interaction-store";
import { RenderHtmlSlot } from "./features/tool-call-slots/components/render-html-slot";
import { RenderUiSlot } from "./features/tool-call-slots/components/render-ui-slot";
import type { GenerativeUiDeps } from "./shared/state/generative-ui-deps";
import { registerPromptProvider } from "./prompt/register-prompt-provider";
import { registerTools } from "./tools/register-tools";
import { RENDER_HTML_TOOL, RENDER_UI_TOOL } from "./tools/tool-scopes";
// Tailwind pipeline only; the build scopes it to the plugin root.
import "./style.css";

export default definePlugin({
    activate(ctx) {
        const deps: GenerativeUiDeps = {
            sendPrompt: (text) => ctx.conversation.sendPrompt(text),
            notify: (options) => ctx.ui.notify(options),
            interactions: new InteractionStore(ctx.storage),
        };
        const disposables = [
            registerPromptProvider(ctx),
            ...registerTools(ctx),
            ctx.ui.registerToolCallSlot({
                id: "render-ui-view",
                toolName: RENDER_UI_TOOL,
                component: (props: PluginToolCallSlotProps) => <RenderUiSlot {...props} deps={deps} />,
            }),
            ctx.ui.registerToolCallSlot({
                id: "render-html-view",
                toolName: RENDER_HTML_TOOL,
                component: (props: PluginToolCallSlotProps) => <RenderHtmlSlot {...props} deps={deps} />,
            }),
        ];
        return () => {
            for (const disposable of disposables) disposable.dispose();
        };
    },
});
