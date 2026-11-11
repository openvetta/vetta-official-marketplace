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
        <div role="tablist" className="flex gap-1">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={tab.id === active}
                    onClick={() => onChange(tab.id)}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                        tab.id === active
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                >
                    {tab.label}
                    {tab.count ? (
                        <span className="rounded-full bg-background/60 px-1.5 text-[11px] leading-4 text-muted-foreground">{tab.count}</span>
                    ) : null}
                </button>
            ))}
        </div>
    );
}
