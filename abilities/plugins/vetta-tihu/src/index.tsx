import { definePlugin } from "@vetta-org/plugin-sdk";
import { BikeIcon } from "./features/pelican-ride/components/bike-icon";
import { createPelicanPanel } from "./features/pelican-ride/components/pelican-panel";
import { PELICAN_TAB_ID } from "./features/pelican-ride/tab-id";
import { registerTools } from "./tools/register-tools";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";

export default definePlugin({
	activate(ctx) {
		const disposables = [
			ctx.ui.registerActivityTab({
				id: PELICAN_TAB_ID,
				label: "%tab.label%",
				icon: <BikeIcon />,
				component: createPelicanPanel(ctx.ui.notify),
				scope_use: ["conversation", "project"],
				retention: "pinned",
			}),
			...registerTools(ctx),
		];
		return () => {
			for (const disposable of disposables) disposable.dispose();
		};
	},
});
