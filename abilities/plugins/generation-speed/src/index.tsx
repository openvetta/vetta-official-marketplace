import { definePlugin } from "@vetta-org/plugin-sdk";
import { TurnSpeedCard } from "./features/turn-summary/components/turn-speed-card";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";

export default definePlugin({
	activate(ctx) {
		// 消息列表底部、最新一轮下方的速度读数行，点击打开详情。
		ctx.ui.registerTurnCard({
			id: "turn-speed",
			component: TurnSpeedCard,
			scope_use: ["conversation", "project"],
		});
	},
});
