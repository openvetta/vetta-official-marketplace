import { useGenerationMetrics } from "@vetta-org/plugin-sdk";
import { useState } from "react";
import { HudDetailsDialog, type HudTab } from "../../hud-details/components/hud-details-dialog";
import { SourceChipsRow } from "../../turn-sources/components/source-chips-row";
import { useTurnSources } from "../../turn-sources/hooks/use-turn-sources";
import { useSpeedHistory } from "../hooks/use-speed-history";
import { SpeedReadoutRow } from "./speed-readout-row";

/**
 * 最新一轮回复下方的 HUD：第一行生成速度，第二行本轮来源。
 * 两行各自在没有数据时隐藏；点击任一行打开详情并定位到对应标签页。
 */
export function ReplyHudCard() {
	const snapshot = useGenerationMetrics();
	const history = useSpeedHistory(snapshot);
	const sources = useTurnSources();
	const [openTab, setOpenTab] = useState<HudTab | null>(null);

	return (
		<div className="flex min-w-0 flex-col items-start">
			<SpeedReadoutRow snapshot={snapshot} onOpen={() => setOpenTab("speed")} />
			<SourceChipsRow sources={sources} onShowAll={() => setOpenTab("sources")} />
			{openTab ? (
				<HudDetailsDialog
					tab={openTab}
					onTabChange={setOpenTab}
					onOpenChange={(open) => {
						if (!open) setOpenTab(null);
					}}
					snapshot={snapshot}
					history={history}
					sources={sources}
				/>
			) : null}
		</div>
	);
}
