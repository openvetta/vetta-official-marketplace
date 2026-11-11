import type { ReactElement, ReactNode } from "react";

const TONES = {
    neutral: "bg-muted text-muted-foreground",
    accent: "bg-primary/15 text-primary",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
} as const;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES }): ReactElement {
    return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] leading-4 ${TONES[tone]}`}>{children}</span>;
}
