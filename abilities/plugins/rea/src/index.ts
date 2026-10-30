import { definePlugin } from "@vetta-org/plugin-sdk";
import { createInvestigateActions } from "./features/target-intake/services/investigate-command";
import { registerEvidenceHooks } from "./hooks/register-evidence-hook";
import { clearPluginContext, setNotify, setPluginContext } from "./plugin-context";
import { registerCaseTools } from "./tools/register-tools";

/**
 * REA has no page of its own: the agent is the interface.
 *
 * What the plugin adds to a conversation is the part a transcript cannot hold —
 * a case that survives the session, filled automatically from the REA tools the
 * agent already ran, and readable back through `case_status` / `case_report`.
 */
export default definePlugin({
	activate(ctx) {
		// The token lets this activation release the shared handle only while it is
		// still the owner; a reload activates the next instance before this cleanup.
		const token = setPluginContext(ctx);
		setNotify(ctx.ui.notify);

		const disposables = [
			...createInvestigateActions(ctx).map((action) => ctx.fileExplorer.registerContextMenuAction(action)),
			...registerCaseTools(ctx),
			// Hooks are optional: a host without the coding-agent hook runtime keeps
			// the manual tools, only auto-capture is missing.
			...registerEvidenceHooks(ctx),
		];

		return () => {
			for (const disposable of disposables) {
				try {
					disposable.dispose();
				} catch (error) {
					console.warn("[rea] failed to dispose a contribution", error);
				}
			}
			clearPluginContext(token);
		};
	},
});
