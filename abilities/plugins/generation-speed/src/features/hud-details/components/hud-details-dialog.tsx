import { useTranslation, type GenerationMetricsSnapshot } from "@vetta-org/plugin-sdk";
import { ButtonGroup, ButtonGroupItem, Dialog, DialogContent, DialogHeader, DialogTitle } from "@vetta-org/ui";
import type { TurnSource } from "../../../domain/turn-sources";
import { SpeedPanel } from "../../speed-details/components/speed-panel";
import { SourceListPanel } from "../../turn-sources/components/source-list-panel";
import type { SpeedSample } from "../../turn-summary/hooks/use-speed-history";

export type HudTab = "speed" | "sources";

/**
 * 固定尺寸：生成中数据每 250ms 刷新，尺寸随内容变化会抖。
 * 高度按「速度」页右栏最高内容算：内边距 48 + 标题与标签 70 + 间距 20 + 指标 204 + 间距 16 + token 构成 74 ≈ 432，再留余量。
 */
const DIALOG_WIDTH = 680;
const DIALOG_HEIGHT = 456;

/**
 * 回复 HUD 的详情：标签页切换「速度 / 来源」。用宿主 Dialog（焦点、Esc、遮罩由 Vetta 负责）。
 */
export function HudDetailsDialog({
	tab,
	onTabChange,
	onOpenChange,
	snapshot,
	history,
	sources,
}: {
	tab: HudTab;
	onTabChange: (tab: HudTab) => void;
	onOpenChange: (open: boolean) => void;
	snapshot: GenerationMetricsSnapshot;
	history: readonly SpeedSample[];
	sources: readonly TurnSource[];
}) {
	const { t } = useTranslation();

	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				style={{
					width: DIALOG_WIDTH,
					maxWidth: "calc(100% - 2rem)",
					height: DIALOG_HEIGHT,
					gridTemplateRows: "auto minmax(0, 1fr)",
				}}
			>
				<DialogHeader className="gap-3">
					<DialogTitle>{t("details.title")}</DialogTitle>
					<ButtonGroup variant="flat" role="tablist" aria-label={t("details.title")} className="self-start">
						<ButtonGroupItem
							role="tab"
							aria-selected={tab === "speed"}
							active={tab === "speed"}
							label={t("tab.speed")}
							onClick={() => onTabChange("speed")}
						/>
						<ButtonGroupItem
							role="tab"
							aria-selected={tab === "sources"}
							active={tab === "sources"}
							label={t("tab.sources", { count: sources.length })}
							onClick={() => onTabChange("sources")}
						/>
					</ButtonGroup>
				</DialogHeader>

				<div role="tabpanel" className="min-h-0 overflow-hidden">
					{tab === "speed" ? (
						<SpeedPanel snapshot={snapshot} history={history} />
					) : (
						<SourceListPanel sources={sources} />
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
