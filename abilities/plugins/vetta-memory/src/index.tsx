import { definePlugin } from "@vetta-org/plugin-sdk";
import { MemoryServices } from "./domain/memory-services";
import { MemoryManagerView } from "./features/memory-manager/components/memory-manager-view";
import { registerHooks } from "./hooks/register-hooks";
import { registerPromptProvider } from "./prompt/register-prompt-provider";
import type { MemoryManagerDeps } from "./shared/state/manager-deps";
import { registerTools } from "./tools/register-tools";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";

export default definePlugin({
    activate(ctx) {
        const services = new MemoryServices(ctx.storage);
        const deps: MemoryManagerDeps = {
            services,
            listModels: () => ctx.ai.listModels(),
            notify: (options) => ctx.ui.notify(options),
        };
        // Load eagerly so the first turn does not pay for it; failures surface on the Memory page.
        void services.loadAll().catch((error: unknown) => ctx.ui.notify({ message: "Could not load memory", error }));

        const disposables = [
            registerPromptProvider(ctx, services),
            ...registerTools(ctx, services),
            ...registerHooks(ctx, services),
            ctx.ui.registerWorkspaceView({
                id: "memory",
                label: "%view.label%",
                description: "%view.description%",
                icon: "icon-[solar--brain-linear]",
                component: () => <MemoryManagerView deps={deps} />,
            }),
        ];
        return () => {
            for (const disposable of disposables) disposable.dispose();
            services.snapshots.clear();
        };
    },
});
