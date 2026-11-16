import { useTranslation } from "@vetta-org/plugin-sdk";
import { useRef } from "react";
import type { ChartBlock as ChartBlockSpec } from "../../../domain/ui-schema";
import type { GenerativeUiDeps } from "../../../shared/state/generative-ui-deps";
import { useChart } from "../hooks/use-chart";

export function ChartBlock({ block, deps }: { block: ChartBlockSpec; deps: GenerativeUiDeps }) {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useChart(canvasRef, block, (error) => deps.notify({ message: t("error.chart"), error }));
    return (
        <figure>
            {block.title ? <figcaption className="mb-2 text-sm font-medium text-foreground">{block.title}</figcaption> : null}
            <div className="relative w-full text-xs text-muted-foreground" style={{ height: block.height ?? 280 }}>
                <canvas ref={canvasRef} role="img" aria-label={block.title ?? t("chart.label")} />
            </div>
        </figure>
    );
}
