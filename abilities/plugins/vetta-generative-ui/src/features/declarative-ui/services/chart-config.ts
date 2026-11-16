import type { ChartBlock } from "../../../domain/ui-schema";

/** Calm palette that reads on light and dark backgrounds. */
export const CHART_PALETTE = ["#6366f1", "#14b8a6", "#f59e0b", "#ec4899", "#0ea5e9", "#84cc16", "#a855f7", "#f97316"];

const withAlpha = (hex: string, alpha: number) =>
    `${hex}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`;

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

function deepMerge(base: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(extra)) {
        out[key] = isRecord(value) && isRecord(out[key]) ? deepMerge(out[key] as Record<string, unknown>, value) : value;
    }
    return out;
}

export interface ChartTheme {
    text: string;
    grid: string;
    font: string;
}

/** Fills only the colours the model left out, so explicit Chart.js styling still wins. */
export function buildChartConfig(block: ChartBlock, theme: ChartTheme) {
    const radial = ["pie", "doughnut", "polarArea"].includes(block.chartType);
    const datasets = block.data.datasets.map((dataset, index) => {
        const color = CHART_PALETTE[index % CHART_PALETTE.length]!;
        const count = Array.isArray(dataset.data) ? dataset.data.length : 0;
        const sliceColors = Array.from({ length: count }, (_, i) => CHART_PALETTE[i % CHART_PALETTE.length]!);
        const defaults: Record<string, unknown> = radial
            ? { backgroundColor: sliceColors, borderColor: "transparent", borderWidth: 0, hoverOffset: 6 }
            : block.chartType === "line" || block.chartType === "radar"
              ? { borderColor: color, backgroundColor: withAlpha(color, 0.15), pointRadius: 2.5, borderWidth: 2, tension: 0.35 }
              : { backgroundColor: withAlpha(color, 0.85), borderColor: color, borderRadius: 6, borderWidth: 0, maxBarThickness: 36 };
        return { ...defaults, ...dataset };
    });

    const grid = { color: theme.grid, drawBorder: false };
    const ticks = { color: theme.text };
    const baseOptions: Record<string, unknown> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        font: { family: theme.font },
        plugins: {
            legend: {
                display: datasets.length > 1 || radial,
                position: "bottom",
                labels: { color: theme.text, usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 14 },
            },
            title: { display: false },
            tooltip: { cornerRadius: 8, padding: 10 },
        },
        ...(radial
            ? {}
            : block.chartType === "radar"
              ? { scales: { r: { grid, angleLines: { color: theme.grid }, pointLabels: { color: theme.text }, ticks: { display: false } } } }
              : { scales: { x: { grid: { display: false }, ticks }, y: { grid, ticks, border: { display: false } } } }),
    };

    return {
        type: block.chartType,
        data: { ...block.data, datasets },
        options: deepMerge(baseOptions, block.options ?? {}),
    };
}
