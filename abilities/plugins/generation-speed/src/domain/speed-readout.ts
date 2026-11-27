import type { GenerationMetricsSnapshot, GenerationPhase } from "@vetta-org/plugin-sdk";

/** 顶栏读数处于哪种状态，决定文案与是否高亮。 */
export type SpeedReadoutState =
	/** 正在出字：显示最近 2 秒的实时速度。 */
	| "live"
	/** 请求已发出，等待首字。 */
	| "waiting"
	/** 轮次进行中、工具在执行：显示上一次调用的平均速度。 */
	| "between-calls"
	/** 没有进行中的生成：显示最近一次调用的结算速度。 */
	| "settled"
	/** 当前会话还没有任何生成。 */
	| "empty";

export interface SpeedReadout {
	state: SpeedReadoutState;
	/** tok/s；没有可显示的速度时为 null。 */
	tokensPerSecond: number | null;
	/** 是否为估算值（生成中的读数始终是估算）。 */
	approximate: boolean;
}

const GENERATING_PHASES: readonly GenerationPhase[] = ["thinking", "text", "tool-args"];

/**
 * 把宿主快照收窄成顶栏要显示的一个读数。
 * 宿主不支持当前会话（没有会话、团队会话）时返回 null，调用方应隐藏按钮而不是显示 0。
 */
export function toSpeedReadout(snapshot: GenerationMetricsSnapshot): SpeedReadout | null {
	if (!snapshot.supported) return null;
	const { call, phase } = snapshot;

	if (phase === "waiting") return { state: "waiting", tokensPerSecond: null, approximate: false };
	if (!call) return { state: "empty", tokensPerSecond: null, approximate: false };

	if (call.status === "streaming" && GENERATING_PHASES.includes(phase)) {
		return { state: "live", tokensPerSecond: call.recentTokensPerSecond, approximate: true };
	}

	return {
		state: phase === "between-calls" ? "between-calls" : "settled",
		tokensPerSecond: call.tokensPerSecond,
		approximate: call.estimated,
	};
}
