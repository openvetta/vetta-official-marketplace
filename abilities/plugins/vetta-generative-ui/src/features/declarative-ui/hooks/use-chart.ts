import Chart from "chart.js/auto";
import { type RefObject, useEffect } from "react";
import type { ChartBlock } from "../../../domain/ui-schema";
import { buildChartConfig } from "../services/chart-config";

/** Owns one Chart.js instance on a canvas; rebuilt when the block changes, destroyed on unmount. */
export function useChart(canvasRef: RefObject<HTMLCanvasElement | null>, block: ChartBlock, onError: (error: unknown) => void) {
    const signature = JSON.stringify(block);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const style = getComputedStyle(canvas.parentElement ?? canvas);
        let chart: Chart | null = null;
        try {
            const config = buildChartConfig(block, {
                text: style.color || "#71717a",
                grid: "rgba(127, 127, 127, 0.16)",
                font: style.fontFamily || "system-ui",
            });
            chart = new Chart(canvas, config as never);
        } catch (error) {
            onError(error);
        }
        return () => chart?.destroy();
        // `signature` stands in for deep equality of the block.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);
}
