import { definePlugin, type PluginContext } from "@vetta-org/plugin-sdk";
import { createElement } from "react";
import { WebAccessSettingsView } from "./features/settings/components/web-access-settings-view";
import { WebAccessSetupSlot } from "./features/setup/components/web-access-setup-slot";
import { createNetworkRequest } from "./services/host-network";
import { createSettingsStore } from "./services/settings-store";
import { registerWebAccessTools } from "./tools/register-tools";
import "./style.css";

const SETTINGS_VIEW_ID = "settings";
const ABILITY_ID = "web-access";

export default definePlugin({
  activate(ctx: PluginContext) {
    const store = createSettingsStore({ storage: ctx.storage, secrets: ctx.secrets });
    const call = createNetworkRequest(ctx);
    const notify = (message: string, error?: unknown) => ctx.ui.notify({ message, ...(error ? { error } : {}) });

    // A corrupt settings file must not take the tools down with it.
    void store.ready().catch((error: unknown) => notify("Web Access could not read its settings", error));

    const tools = registerWebAccessTools(ctx, store, call);

    // A settings page is not a daily surface: keep it under Settings → More options
    // instead of taking a permanent slot in the user's sidebar.
    const view = ctx.ui.registerWorkspaceView({
      id: SETTINGS_VIEW_ID,
      label: "%view.settings.label%",
      description: "%view.settings.description%",
      sidebar: false,
      component: () =>
        createElement(WebAccessSettingsView, {
          store,
          call,
          notify
        })
    });

    const setup = ctx.ui.registerAbilityDetailSlot({
      id: "setup",
      abilityId: ABILITY_ID,
      component: () =>
        createElement(WebAccessSetupSlot, {
          store,
          call,
          openSettings: () => ctx.ui.openWorkspaceView(SETTINGS_VIEW_ID)
        })
    });

    return () => {
      for (const tool of tools) tool.dispose();
      setup.dispose();
      view.dispose();
    };
  }
});
