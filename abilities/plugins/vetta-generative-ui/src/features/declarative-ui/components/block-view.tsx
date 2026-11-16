import type { Block } from "../../../domain/ui-schema";
import type { ViewEnv } from "../view-env";
import { CardBlock } from "./card-block";
import { ColumnsBlock } from "./columns-block";
import { LeafBlockView } from "./leaf-block-view";
import { TabsBlock } from "./tabs-block";

export function BlockView({ block, path, env }: { block: Block; path: string; env: ViewEnv }) {
    switch (block.type) {
        case "card":
            return <CardBlock title={block.title} description={block.description} blocks={block.blocks} path={path} env={env} />;
        case "columns":
            return <ColumnsBlock columns={block.columns} weights={block.weights} path={path} env={env} />;
        case "tabs":
            return <TabsBlock tabs={block.tabs} path={path} env={env} />;
        default:
            return <LeafBlockView block={block} path={path} env={env} />;
    }
}
