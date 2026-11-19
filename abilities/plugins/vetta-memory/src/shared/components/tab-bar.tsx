import { Button } from "@vetta-org/ui";
import type { ReactElement } from "react";

export interface TabItem<T extends string> {
    id: T;
    label: string;
    count?: number;
}

export function TabBar<T extends string>({
    tabs,
    active,
    onChange,
}: {
    tabs: readonly TabItem<T>[];
    active: T;
    onChange: (id: T) => void;
}): ReactElement {
    return (
        <div role="tablist" className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
                <Button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={tab.id === active}
                    variant={tab.id === active ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={() => onChange(tab.id)}
                >
                    {tab.label}
                    {tab.count ? (
                        <span className="rounded-full bg-background/60 px-1.5 text-[11px] leading-4 text-muted-foreground">{tab.count}</span>
                    ) : null}
                </Button>
            ))}
        </div>
    );
}
