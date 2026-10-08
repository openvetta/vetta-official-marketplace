import { useTranslation } from "@vetta-org/plugin-sdk";
import { type ReactElement } from "react";
import { type QuotaWindow } from "../../../proxy-client";

/** One limit window: how much is left, and when it comes back. */
export function QuotaBar({ window, label, countdown }: {
  window: QuotaWindow;
  label: (minutes: number | undefined) => string;
  countdown: (window: QuotaWindow) => string | undefined;
}): ReactElement {
  const { t } = useTranslation();
  const left = Math.round(window.remainingPercent);
  const tone = left >= 50 ? "bg-emerald-500/80" : left >= 20 ? "bg-amber-500/80" : "bg-destructive/80";
  const due = countdown(window);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]">
        <span className="min-w-0 truncate text-muted-foreground">{window.label ?? label(window.windowMinutes)}</span>
        <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
          <span className={left >= 50 ? "text-emerald-400" : left >= 20 ? "text-amber-400" : "text-destructive"}>
            {t("console.remaining", { percent: left })}
          </span>
          {due ? <span className="text-muted-foreground">{due}</span> : null}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted-foreground/15">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${left}%` }} />
      </div>
    </div>
  );
}
