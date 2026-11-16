type Stat = { label: string; value: string | number; delta?: string; trend?: "up" | "down" | "flat"; hint?: string };

const TREND = {
    up: { className: "text-emerald-600 dark:text-emerald-400", icon: "icon-[solar--arrow-right-up-linear]" },
    down: { className: "text-red-600 dark:text-red-400", icon: "icon-[solar--arrow-right-down-linear]" },
    flat: { className: "text-muted-foreground", icon: "icon-[solar--arrow-right-linear]" },
} as const;

export function StatsBlock({ items }: { items: Stat[] }) {
    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            {items.map((item, index) => {
                const trend = TREND[item.trend ?? "flat"];
                return (
                    <div key={`${item.label}-${index}`} className="rounded-xl bg-muted/60 px-4 py-3.5">
                        <div className="truncate text-xs text-muted-foreground">{item.label}</div>
                        <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-foreground">{item.value}</div>
                        {item.delta || item.hint ? (
                            <div className="mt-1 flex items-center gap-1.5 text-xs">
                                {item.delta ? (
                                    <span className={`inline-flex items-center gap-0.5 font-medium ${trend.className}`}>
                                        {item.trend ? <span aria-hidden="true" className={`size-3.5 ${trend.icon}`} /> : null}
                                        {item.delta}
                                    </span>
                                ) : null}
                                {item.hint ? <span className="truncate text-muted-foreground">{item.hint}</span> : null}
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}
