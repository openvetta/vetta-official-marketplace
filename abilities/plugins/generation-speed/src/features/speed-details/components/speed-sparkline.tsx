import type { SpeedSample } from "../../turn-summary/hooks/use-speed-history";

const WIDTH = 320;

/**
 * 实时速度走势，固定高度：数据不足时显示占位文字，不改变占位尺寸。
 * 对话框挂在 body 上，插件的作用域样式管不到，所以颜色与尺寸写在属性和内联样式里。
 */
export function SpeedSparkline({
	samples,
	label,
	emptyText,
	height,
}: {
	samples: readonly SpeedSample[];
	label: string;
	emptyText: string;
	height: number;
}) {
	if (samples.length < 2) {
		return (
			<div
				className="flex items-center justify-center rounded-xl bg-muted/50 text-xs text-muted-foreground"
				style={{ height }}
			>
				{emptyText}
			</div>
		);
	}

	const max = Math.max(...samples.map((sample) => sample.value), 1);
	const first = samples[0].at;
	const span = Math.max(samples[samples.length - 1].at - first, 1);
	const points = samples.map((sample) => {
		const x = ((sample.at - first) / span) * WIDTH;
		const y = height - 4 - (sample.value / max) * (height - 8);
		return `${x.toFixed(1)},${y.toFixed(1)}`;
	});
	const line = points.join(" ");
	const area = `0,${height} ${line} ${WIDTH},${height}`;

	return (
		<svg
			role="img"
			aria-label={label}
			viewBox={`0 0 ${WIDTH} ${height}`}
			preserveAspectRatio="none"
			width="100%"
			height={height}
			style={{ display: "block", color: "#0ea5e9" }}
		>
			<polygon points={area} fill="currentColor" fillOpacity={0.12} />
			<polyline
				points={line}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinejoin="round"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
