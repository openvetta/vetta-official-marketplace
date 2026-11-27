import { useTranslation, type GenerationMetricsSnapshot } from "@vetta-org/plugin-sdk";
import { toSpeedReadout } from "../../../domain/speed-readout";
import { formatDuration, formatSpeed, formatTokens } from "../../../shared/formatters/metric-format";
import { SpeedIcon } from "./speed-icon";

/**
 * 卡片第一行：生成中显示实时速度与阶段，本轮结束后显示整轮汇总，点击打开详情。
 * 没有生成记录或宿主不支持时不显示。
 */
export function SpeedReadoutRow({ snapshot, onOpen }: { snapshot: GenerationMetricsSnapshot; onOpen: () => void }) {
	const { t } = useTranslation();
	const readout = toSpeedReadout(snapshot);
	const { call, turn } = snapshot;
	if (!readout || !call || readout.state === "empty") return null;

	const live = readout.state === "live";
	const running = turn?.status === "running";
	// 轮次结束后用整轮平均（不含工具执行时间），进行中用当前读数。
	const speed =
		!running && turn
			? formatSpeed(turn.tokensPerSecond, turn.estimated)
			: readout.state === "waiting"
				? t("readout.waiting")
				: formatSpeed(readout.tokensPerSecond, readout.approximate);

	const details = [
		call.timeToFirstTokenMs !== null ? t("card.firstToken", { value: formatDuration(call.timeToFirstTokenMs) }) : null,
		turn ? t("card.output", { value: formatTokens(turn.outputTokens, turn.estimated) }) : null,
		turn && turn.modelCalls > 1 ? t("card.calls", { value: turn.modelCalls }) : null,
		call.model?.id ?? null,
	].filter((part): part is string => part !== null);

	return (
		<button
			type="button"
			onClick={onOpen}
			title={t("card.openDetails")}
			aria-haspopup="dialog"
			className="flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-left text-[12px] leading-4 text-muted-foreground transition-colors hover:bg-accent/40"
		>
			<span
				aria-hidden="true"
				className={`flex size-4 shrink-0 items-center justify-center ${live ? "text-sky-500" : ""}`}
			>
				<SpeedIcon live={live} />
			</span>
			<span className="shrink-0 font-medium tabular-nums text-foreground">{speed}</span>
			{running ? <span className="shrink-0">{t(`phase.${snapshot.phase}`)}</span> : null}
			{details.length > 0 ? <span className="min-w-0 truncate tabular-nums">{details.join(" · ")}</span> : null}
		</button>
	);
}
