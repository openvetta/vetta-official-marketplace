interface ToolNoticeProps {
    tone: "error" | "muted";
    title: string;
    detail?: string;
}

export function ToolNotice({ tone, title, detail }: ToolNoticeProps) {
    const error = tone === "error";
    return (
        <div
            role={error ? "alert" : "status"}
            className={`my-1.5 flex max-w-3xl gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] ${
                error ? "bg-red-500/8 text-red-700 dark:text-red-300" : "bg-muted/50 text-muted-foreground"
            }`}
        >
            <span aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${error ? "icon-[solar--danger-circle-linear]" : "icon-[solar--forbidden-circle-linear]"}`} />
            <div className="min-w-0">
                <div className="font-medium">{title}</div>
                {detail ? <pre className="mt-1 max-h-40 overflow-auto font-mono text-[11px] whitespace-pre-wrap opacity-80">{detail}</pre> : null}
            </div>
        </div>
    );
}
