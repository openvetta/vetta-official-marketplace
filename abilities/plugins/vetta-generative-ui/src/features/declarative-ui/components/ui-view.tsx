import type { UiDocument } from "../../../domain/ui-schema";
import type { ViewEnv } from "../view-env";
import { BlockView } from "./block-view";

export function UiView({ document, env }: { document: UiDocument; env: ViewEnv }) {
    return (
        <div className={`my-2 w-full ${document.width === "wide" ? "max-w-5xl" : "max-w-3xl"}`}>
            {document.title || document.description ? (
                <header className="mb-5">
                    {document.title ? <h3 className="text-base font-semibold tracking-tight text-foreground">{document.title}</h3> : null}
                    {document.description ? <p className="mt-1 text-[13px] text-muted-foreground">{document.description}</p> : null}
                </header>
            ) : null}
            <div className="flex flex-col gap-5">
                {document.blocks.map((block, index) => (
                    <BlockView key={index} block={block} path={String(index)} env={env} />
                ))}
            </div>
        </div>
    );
}
