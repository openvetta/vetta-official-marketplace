import type { ReactElement } from "react";

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }): ReactElement {
    return (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className={`${icon} size-8 text-muted-foreground/50`} />
            <p className="m-0 text-sm font-medium text-foreground">{title}</p>
            {hint ? <p className="m-0 max-w-sm text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
        </div>
    );
}
