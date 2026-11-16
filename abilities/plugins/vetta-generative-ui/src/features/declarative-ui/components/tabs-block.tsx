import { useId, useState } from "react";
import type { Block } from "../../../domain/ui-schema";
import type { ViewEnv } from "../view-env";
import { BlockStack } from "./block-stack";

export function TabsBlock({ tabs, path, env }: { tabs: Array<{ label: string; blocks: Block[] }>; path: string; env: ViewEnv }) {
    const [active, setActive] = useState(0);
    const id = useId();
    return (
        <div className="flex flex-col items-stretch gap-4">
            <div role="tablist" className="inline-flex max-w-full self-start gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5">
                {tabs.map((tab, index) => (
                    <button
                        key={`${tab.label}-${index}`}
                        id={`${id}-tab-${index}`}
                        type="button"
                        role="tab"
                        aria-selected={active === index}
                        aria-controls={`${id}-panel-${index}`}
                        className={`h-7 shrink-0 rounded-md px-3 text-[13px] font-medium transition ${
                            active === index ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setActive(index)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {tabs.map((tab, index) => (
                // Inactive panels stay mounted so form input is not lost when switching tabs.
                <div key={index} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={active !== index}>
                    <BlockStack blocks={tab.blocks} path={`${path}.${index}`} env={env} />
                </div>
            ))}
        </div>
    );
}
