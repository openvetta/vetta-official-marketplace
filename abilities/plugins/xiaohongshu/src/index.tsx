import { definePlugin } from "@vetta-org/plugin-sdk";
import { createElement } from "react";
import { ensureServiceStarted } from "./runtime";
import { XhsSetupSlot } from "./features/account-connection/components/xhs-setup-slot";
import { XhsAccountsView } from "./features/account-management/components/xhs-accounts-view";
import type { ManagedPluginContext } from "./runtime-contract";
import "./style.css";

export default definePlugin({
	async activate(ctx) {
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
			iconTint: false,
			component: () => createElement(XhsAccountsView, { context }),
		});
		// Wait for the service before committing the activation.  The host builds
		// the Agent MCP snapshot immediately after activation; returning early
		// used to race that snapshot and temporarily drop the MCP server while the
		// old UI was still polling the service during a plugin update.
		try {
			await ensureServiceStarted(context);
		} catch (reason: unknown) {
			context.ui.notify({
				message: "小红书服务启动失败",
				error: reason,
				variant: "error",
			});
		}
		return async () => {
			accounts.dispose();
			setup.dispose();
		};
	},
});
