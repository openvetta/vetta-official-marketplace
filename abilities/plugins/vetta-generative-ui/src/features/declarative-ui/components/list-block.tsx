type Item = { title: string; description?: string; meta?: string };

export function ListBlock({ items, ordered }: { items: Item[]; ordered?: boolean }) {
    const Tag = ordered ? "ol" : "ul";
    return (
        <Tag className="rounded-xl bg-muted/50 py-1.5">
            {items.map((item, index) => (
                <li key={`${item.title}-${index}`} className="flex items-start gap-3 px-4 py-2.5">
                    {ordered ? (
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-medium text-muted-foreground">
                            {index + 1}
                        </span>
                    ) : (
                        <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{item.title}</div>
                        {item.description ? <div className="mt-0.5 text-[13px] text-muted-foreground">{item.description}</div> : null}
                    </div>
                    {item.meta ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.meta}</span> : null}
                </li>
            ))}
        </Tag>
    );
}
