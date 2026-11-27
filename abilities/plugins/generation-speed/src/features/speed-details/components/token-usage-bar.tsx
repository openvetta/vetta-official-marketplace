import type { GenerationTokenUsage } from "@vetta-org/plugin-sdk";
import { formatTokens } from "../../../shared/formatters/metric-format";

/** 颜色写成内联值：对话框在插件样式作用域之外。 */
const SEGMENTS = [
	{ key: "input", color: "#0ea5e9" },
	{ key: "cacheRead", color: "#10b981" },
	{ key: "cacheWrite", color: "#f59e0b" },
	{ key: "output", color: "#8b5cf6" },
] as const satisfies readonly { key: keyof GenerationTokenUsage; color: string }[];

/**
 * 本次调用的 token 构成：一条比例条加图例。
 * 没有用量（生成中、provider 不报）时仍占同样的位置，只显示空条和「—」，避免布局跳动。
 */
export function TokenUsageBar({
	usage,
	labels,
}: {
	usage: GenerationTokenUsage | null;
	labels: Record<keyof GenerationTokenUsage, string>;
}) {
	const total = usage ? SEGMENTS.reduce((sum, segment) => sum + usage[segment.key], 0) : 0;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
				{usage && total > 0
					? SEGMENTS.map((segment) =>
							usage[segment.key] > 0 ? (
								<span
									key={segment.key}
									style={{ width: `${(usage[segment.key] / total) * 100}%`, backgroundColor: segment.color }}
								/>
							) : null,
						)
					: null}
			</div>
			<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
				{SEGMENTS.map((segment) => (
					<div key={segment.key} className="flex items-center justify-between gap-2">
						<span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
							<span
								aria-hidden="true"
								style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: segment.color, flexShrink: 0 }}
							/>
							<span className="truncate">{labels[segment.key]}</span>
						</span>
						<span className="tabular-nums text-foreground">{usage ? formatTokens(usage[segment.key]) : "—"}</span>
					</div>
				))}
			</div>
		</div>
	);
}
