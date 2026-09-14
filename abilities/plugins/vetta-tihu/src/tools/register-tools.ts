import type { Disposable, PluginContext } from "@vetta-org/plugin-sdk";
import { PELICAN_TAB_ID } from "../features/pelican-ride/tab-id";
import { createPelicanBikeControlTool } from "./pelican-bike-control";

export function registerTools(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool(
			createPelicanBikeControlTool({
				openPanel: (cwd) => ctx.ui.openActivityTab(PELICAN_TAB_ID, { cwd }),
				notify: ctx.ui.notify,
				t: ctx.i18n.t,
			}),
		),
	];
}
