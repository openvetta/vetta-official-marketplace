import type { Block } from "../../../domain/ui-schema";
import type { ViewEnv } from "../view-env";
import { BlockStack } from "./block-stack";

interface CardBlockProps {
    title?: string;
    description?: string;
    blocks: Block[];
    path: string;
    env: ViewEnv;
}

export function CardBlock({ title, description, blocks, path, env }: CardBlockProps) {
    return (
        <section className="rounded-2xl bg-muted/60 p-5">
            {title || description ? (
                <header className="mb-4">
                    {title ? <h4 className="text-sm font-semibold text-foreground">{title}</h4> : null}
                    {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
                </header>
            ) : null}
            <BlockStack blocks={blocks} path={path} env={env} />
        </section>
    );
}
