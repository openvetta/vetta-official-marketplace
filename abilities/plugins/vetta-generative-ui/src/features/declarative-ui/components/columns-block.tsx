import type { CSSProperties } from "react";
import type { Block } from "../../../domain/ui-schema";
import type { ViewEnv } from "../view-env";
import { BlockStack } from "./block-stack";

interface ColumnsBlockProps {
    columns: Array<{ blocks: Block[] }>;
    weights?: number[];
    path: string;
    env: ViewEnv;
}

/** Stacks on narrow containers; side by side from `@xl`, with optional relative widths. */
export function ColumnsBlock({ columns, weights, path, env }: ColumnsBlockProps) {
    const tracks = columns.map((_, index) => `minmax(0, ${weights?.[index] ?? 1}fr)`).join(" ");
    return (
        <div className="@container">
            <div className="grid gap-5 @xl:[grid-template-columns:var(--tracks)]" style={{ "--tracks": tracks } as CSSProperties}>
                {columns.map((column, index) => (
                    <BlockStack key={index} blocks={column.blocks} path={`${path}.${index}`} env={env} />
                ))}
            </div>
        </div>
    );
}
