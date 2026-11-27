import { useTranslation, type GenerationMetricsSnapshot } from "@vetta-org/plugin-sdk";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@vetta-org/ui";
import { toSpeedReadout } from "../../../domain/speed-readout";
import { formatDuration, formatSpeed, formatTokens } from "../../../shared/formatters/metric-format";
import type { SpeedSample } from "../../turn-summary/hooks/use-speed-history";
import { SpeedSparkline } from "./speed-sparkline";
import { StatTile } from "./stat-tile";
import { TokenUsageBar } from "./token-usage-bar";

/**
 * 对话框固定尺寸：生成中数据每 250ms 刷新，尺寸随内容变化会抖。
 * 高度按右栏最高内容算：内边距 48 + 标题区 50 + 间距 20 + 指标 204 + 间距 16 + token 构成 74 ≈ 412，再留余量。
 */
const DIALOG_WIDTH = 680;
const DIALOG_HEIGHT = 432;
const LEFT_COLUMN_WIDTH = 250;
const SPARKLINE_HEIGHT = 120;

/**
 * 点开本轮速度卡片后的详情：左侧大号速度与走势，右侧指标与 token 构成。
 * 所有区块始终占位（没有数据显示「—」或占位文字），数据变化只改文字不改布局。
 * 用宿主 Dialog（焦点、Esc、遮罩由 Vetta 负责）；它挂在 body 上，
 * 里面只用宿主全局样式已有的类名，尺寸与颜色写成内联值。
 */
export function SpeedDetailsDialog({
	open,
	onOpenChange,
	snapshot,
	history,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	snapshot: GenerationMetricsSnapshot;
	history: readonly SpeedSample[];
}) {
	const { t } = useTranslation();
	const readout = toSpeedReadout(snapshot);
	const { call, turn } = snapshot;
	if (!readout || !call) return null;

	const live = readout.state === "live";
	const running = turn?.status === "running";
	const hero = live
		? { value: readout.tokensPerSecond, approximate: true, caption: t("details.liveSpeed") }
		: turn && !running
			? { value: turn.tokensPerSecond, approximate: turn.estimated, caption: t("details.turnAverage") }
			: { value: call.tokensPerSecond, approximate: call.estimated, caption: t("details.callAverage") };
	const heroText = formatSpeed(hero.value, hero.approximate).replace(/ tok\/s$/, "");
	const status = running ? t(`phase.${snapshot.phase}`) : t(`turnStatus.${turn?.status ?? "completed"}`);
	const showEstimateNote = hero.approximate || call.estimated;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				style={{
					width: DIALOG_WIDTH,
					maxWidth: "calc(100% - 2rem)",
					height: DIALOG_HEIGHT,
					gridTemplateRows: "auto minmax(0, 1fr)",
				}}
			>
				<DialogHeader>
					<DialogTitle>{t("details.title")}</DialogTitle>
					<DialogDescription className="truncate">{status}</DialogDescription>
				</DialogHeader>

				<div
					className="min-h-0 gap-6 overflow-hidden"
					style={{ display: "grid", gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px minmax(0, 1fr)` }}
				>
					<section className="flex min-w-0 flex-col gap-3">
						<div className="flex flex-col gap-1">
							<span className="text-3xl leading-none font-semibold tracking-tight tabular-nums text-foreground">
								{heroText}
							</span>
							<span className="truncate text-xs text-muted-foreground">tok/s · {hero.caption}</span>
						</div>
						<div className="flex flex-col gap-1">
							<SpeedSparkline
								samples={history}
								label={t("details.trend")}
								emptyText={t("details.trendEmpty")}
								height={SPARKLINE_HEIGHT}
							/>
							<span className="truncate text-xs text-muted-foreground">{t("details.trend")}</span>
						</div>
						<div className="mt-auto flex flex-col gap-1 text-xs text-muted-foreground">
							<span className="truncate">{t("details.model", { value: call.model?.id ?? "—" })}</span>
							<span className="truncate" style={{ visibility: showEstimateNote ? "visible" : "hidden" }}>
								{t("details.estimatedNote")}
							</span>
						</div>
					</section>

					<section className="flex min-w-0 flex-col gap-4">
						<div className="grid grid-cols-2 gap-3">
							<StatTile label={t("metric.timeToFirstToken")} value={formatDuration(call.timeToFirstTokenMs)} />
							<StatTile label={t("metric.callAverage")} value={formatSpeed(call.tokensPerSecond, call.estimated)} />
							<StatTile
								label={t("metric.turnAverage")}
								value={turn ? formatSpeed(turn.tokensPerSecond, turn.estimated) : "—"}
							/>
							<StatTile label={t("metric.generationTime")} value={turn ? formatDuration(turn.generationMs) : "—"} />
							<StatTile
								label={t("metric.outputTokens")}
								value={
									turn
										? formatTokens(turn.outputTokens, turn.estimated)
										: formatTokens(call.outputTokens, call.estimated)
								}
							/>
							<StatTile label={t("metric.modelCalls")} value={turn ? String(turn.modelCalls) : "—"} />
						</div>
						<div className="flex flex-col gap-2">
							<span className="text-xs font-semibold text-foreground">{t("details.usage")}</span>
							<TokenUsageBar
								usage={call.usage}
								labels={{
									input: t("metric.inputTokens"),
									cacheRead: t("metric.cacheRead"),
									cacheWrite: t("metric.cacheWrite"),
									output: t("metric.outputTokens"),
								}}
							/>
						</div>
					</section>
				</div>
			</DialogContent>
		</Dialog>
	);
}
