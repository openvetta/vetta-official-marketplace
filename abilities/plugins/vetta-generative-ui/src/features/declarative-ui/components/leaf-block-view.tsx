import type { LeafBlock } from "../../../domain/ui-schema";
import type { ViewEnv } from "../view-env";
import { ActionsBlock } from "./actions-block";
import { AlertBlock } from "./alert-block";
import { BadgesBlock } from "./badges-block";
import { ChartBlock } from "./chart-block";
import { FormBlock } from "./form-block";
import { HeadingBlock } from "./heading-block";
import { ImageBlock } from "./image-block";
import { KeyValueBlock } from "./key-value-block";
import { ListBlock } from "./list-block";
import { ProgressBlock } from "./progress-block";
import { StatsBlock } from "./stats-block";
import { TableBlock } from "./table-block";
import { TextBlock } from "./text-block";

/** Maps one content block to its component. `path` identifies interactive blocks across reloads. */
export function LeafBlockView({ block, path, env }: { block: LeafBlock; path: string; env: ViewEnv }) {
    switch (block.type) {
        case "heading":
            return <HeadingBlock text={block.text} level={block.level} />;
        case "text":
            return <TextBlock text={block.text} muted={block.muted} />;
        case "badges":
            return <BadgesBlock items={block.items} />;
        case "alert":
            return <AlertBlock tone={block.tone} title={block.title} text={block.text} />;
        case "stats":
            return <StatsBlock items={block.items} />;
        case "keyValue":
            return <KeyValueBlock items={block.items} />;
        case "table":
            return <TableBlock caption={block.caption} columns={block.columns} rows={block.rows} />;
        case "list":
            return <ListBlock items={block.items} ordered={block.ordered} />;
        case "progress":
            return <ProgressBlock label={block.label} value={block.value} max={block.max} tone={block.tone} />;
        case "image":
            return <ImageBlock src={block.src} alt={block.alt} caption={block.caption} />;
        case "chart":
            return <ChartBlock block={block} deps={env.deps} />;
        case "divider":
            return <hr className="my-1 h-px border-0 bg-muted-foreground/15" />;
        case "actions":
            return <ActionsBlock block={block} path={path} env={env} />;
        case "form":
            return <FormBlock block={block} path={path} env={env} />;
    }
}
