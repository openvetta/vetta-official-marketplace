import { useTranslation } from "@vetta-org/plugin-sdk";

interface ToolNoticeProps {
    title: string;
    detail?: string;
}

/**
 * Deliberately quiet: no red, no alert role. The badge says whose view this is, so a view that
 * cannot be shown is not mistaken for a fault in Vetta itself.
 */
export function ToolNotice({ title, detail }: ToolNoticeProps) {
    const { t } = useTranslation();
    return (
        <div role="status" className="my-1.5 max-w-3xl rounded-xl bg-muted/40 px-3.5 py-2.5 text-[13px] text-muted-foreground">
            <div className="flex items-center gap-2">
                <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
                    <span aria-hidden="true" className="icon-[solar--magic-stick-3-linear] size-3" />
                    {t("name")}
                </span>
                <span className="min-w-0 truncate">{title}</span>
            </div>
            {detail ? (
                <details className="mt-1.5">
                    <summary className="cursor-pointer text-[11px] opacity-70 select-none hover:opacity-100">{t("notice.details")}</summary>
                    <pre className="mt-1 max-h-40 overflow-auto font-mono text-[11px] whitespace-pre-wrap opacity-70">{detail}</pre>
                </details>
            ) : null}
        </div>
    );
}
