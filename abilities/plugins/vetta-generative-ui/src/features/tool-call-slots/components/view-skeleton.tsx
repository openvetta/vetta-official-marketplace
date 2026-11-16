import { useTranslation } from "@vetta-org/plugin-sdk";

/** Placeholder while the Agent is still writing the view's arguments. */
export function ViewSkeleton({ label }: { label: string }) {
    const { t } = useTranslation();
    return (
        <div role="status" aria-label={t("state.generating")} className="my-2 w-full max-w-3xl rounded-2xl bg-muted/50 p-5">
            <div className="mb-4 flex items-center gap-2 text-[13px] text-muted-foreground">
                <span aria-hidden="true" className="icon-[solar--magic-stick-3-linear] size-4 animate-pulse" />
                {label}
            </div>
            <div className="grid animate-pulse gap-3">
                <div className="h-4 w-1/3 rounded bg-muted-foreground/10" />
                <div className="grid grid-cols-3 gap-3">
                    <div className="h-16 rounded-lg bg-muted-foreground/10" />
                    <div className="h-16 rounded-lg bg-muted-foreground/10" />
                    <div className="h-16 rounded-lg bg-muted-foreground/10" />
                </div>
                <div className="h-24 rounded-lg bg-muted-foreground/10" />
            </div>
        </div>
    );
}
