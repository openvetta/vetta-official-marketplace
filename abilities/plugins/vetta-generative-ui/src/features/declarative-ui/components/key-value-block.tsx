export function KeyValueBlock({ items }: { items: Array<{ label: string; value: string | number }> }) {
    return (
        <dl className="rounded-xl bg-muted/50 py-1.5">
            {items.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-baseline justify-between gap-4 px-4 py-2 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
                    <dd className="min-w-0 text-right font-medium break-words text-foreground">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}
