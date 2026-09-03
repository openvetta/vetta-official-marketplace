import { definePlugin, type PluginContext } from "@vetta-org/plugin-sdk";
import { createElement } from "react";
import { ProxySetupSlot } from "./setup-slot";
import { maintainModelConnection } from "./model-connection";
import type { ManagedPluginContext } from "./runtime-contract";
import "./style.css";

export default definePlugin({
  activate(ctx: PluginContext) {
    const context = ctx as ManagedPluginContext;
    const connection = maintainModelConnection(context);
    const slot = context.ui.registerAbilityDetailSlot({
      id: "setup", abilityId: "cli-proxy-api",
      component: () => createElement(ProxySetupSlot, { context })
    });
    return async () => {
      slot.dispose();
      await connection.dispose();
    };
  }
});
