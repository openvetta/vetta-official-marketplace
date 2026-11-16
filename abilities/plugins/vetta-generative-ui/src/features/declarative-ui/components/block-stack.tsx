import type { Block } from "../../../domain/ui-schema";
import type { ViewEnv } from "../view-env";
import { BlockView } from "./block-view";

export function BlockStack({ blocks, path, env }: { blocks: Block[]; path: string; env: ViewEnv }) {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            {blocks.map((block, index) => (
                <BlockView key={index} block={block} path={`${path}.${index}`} env={env} />
            ))}
        </div>
    );
}
