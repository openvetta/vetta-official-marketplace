import { definePlugin, type PluginContext } from "@vetta-org/plugin-sdk";
import { createElement } from "react";
import { ProxySetupSlot } from "./setup-slot";
import { ProxyWorkspaceView, WORKSPACE_VIEW_ID } from "./workspace-view";
import { maintainModelConnection } from "./model-connection";
import type { ManagedPluginContext } from "./runtime-contract";
import { ensureServiceStarted } from "./runtime-provisioner";
import "./style.css";

export default definePlugin({
  activate(ctx: PluginContext) {
    const context = ctx as ManagedPluginContext;
    void ensureServiceStarted(context).catch(() => undefined);
    const connection = maintainModelConnection(context);
    const slot = context.ui.registerAbilityDetailSlot({
      id: "setup", abilityId: "cli-proxy-api",
      component: () => createElement(ProxySetupSlot, { context })
    });
    // The detail slot only exists while the ability page is open, so anything you
    // want to watch day to day — channel health, what each channel can route —
    // needs a surface of its own.
    const view = context.ui.registerWorkspaceView({
      id: WORKSPACE_VIEW_ID,
      label: "%console.title%",
      // No iconify class: the host only generates CSS for classes it can see in its
      // own sources, so a plugin-declared one renders as an empty box. Omitting it
      // falls back to this plugin's packaged icon from plugin.json.
      //
      // That icon is a full-bleed logo with no transparency, and the host's default
      // is to mask artwork with the theme foreground — which turns every opaque
      // pixel into one solid block. Opting out of the tint renders it as a plain
      // image instead, in its own colors.
      iconTint: false,
      description: "%console.subtitle%",
      component: () => createElement(ProxyWorkspaceView, { context })
    });
    return async () => {
      view.dispose();
      slot.dispose();
      await connection.dispose();
    };
  }
});
