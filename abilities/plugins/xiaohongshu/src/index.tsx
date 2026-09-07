import { definePlugin } from "@vetta-org/plugin-sdk";
import { createElement } from "react";
import { ensureServiceStarted } from "./runtime";
import { XhsAccountsView, XhsSetupSlot } from "./ui";
import type { ManagedPluginContext } from "./runtime-contract";
import "./style.css";

export default definePlugin({
  activate(ctx) {
    const context = ctx as ManagedPluginContext;
    const setup = context.ui.registerAbilityDetailSlot({
      id: "setup",
      abilityId: "xiaohongshu",
      component: () => createElement(XhsSetupSlot, { context }),
    });
    const accounts = context.ui.registerWorkspaceView({
      id: "accounts",
      label: "%accounts.title%",
      description: "%accounts.subtitle%",
      component: () => createElement(XhsAccountsView, { context }),
    });
    void ensureServiceStarted(context)
      .catch((reason: unknown) => context.ui.notify({ message: "小红书服务启动失败", error: reason, variant: "error" }));
    return async () => {
      accounts.dispose();
      setup.dispose();
    };
  },
});
