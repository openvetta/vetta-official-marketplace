import type { GenerationMetricsSnapshot } from "@vetta-org/plugin-sdk";
import { useEffect, useState } from "react";

export interface SpeedSample {
	/** 宿主采样时刻（ms）。 */
	at: number;
	/** 最近 2 秒的 tok/s。 */
	value: number;
}

/** 约 30 秒：宿主生成中每 250ms 推一次。 */
export const SPEED_HISTORY_LIMIT = 120;

/**
 * 记录当前轮次生成中的实时速度，供详情里的走势图使用。
 * 切换到新轮次或新会话时清空；只在卡片挂载期间记录，不做持久化。
 */
export function useSpeedHistory(snapshot: GenerationMetricsSnapshot): readonly SpeedSample[] {
	const key = `${snapshot.sessionId ?? ""}:${snapshot.turn?.turnId ?? ""}`;
	const [history, setHistory] = useState<{ key: string; samples: SpeedSample[] }>({ key, samples: [] });

	const call = snapshot.call;
	const value = call?.status === "streaming" ? call.recentTokensPerSecond : null;
	const at = snapshot.sampledAt;

	useEffect(() => {
		setHistory((previous) => {
			const samples = previous.key === key ? previous.samples : [];
			if (value === null || samples.at(-1)?.at === at) {
				return previous.key === key ? previous : { key, samples };
			}
			return { key, samples: [...samples, { at, value }].slice(-SPEED_HISTORY_LIMIT) };
		});
	}, [key, value, at]);

	return history.key === key ? history.samples : [];
}
