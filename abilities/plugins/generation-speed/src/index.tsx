import { definePlugin } from "@vetta-org/plugin-sdk";
import { fetchedPagesStore } from "./features/turn-sources/services/fetched-pages-store";
import { ReplyHudCard } from "./features/turn-summary/components/reply-hud-card";
import { setPluginContext } from "./plugin-context";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";

export default definePlugin({
	activate(ctx) {
		setPluginContext(ctx);

		// 记录本轮工具打开过的网页（宿主只推实时事件，订阅后会回放一次当前会话）。
		const conversationEvents = ctx.conversation.on((event) => fetchedPagesStore.handle(event));

		// 最新一轮回复下方的 HUD：生成速度 + 本轮来源，点击打开详情。
		const card = ctx.ui.registerTurnCard({
			id: "turn-speed",
			component: ReplyHudCard,
			scope_use: ["conversation", "project"],
		});

		return () => {
			conversationEvents.dispose();
			card.dispose();
			setPluginContext(null);
		};
	},
});
