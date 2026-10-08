import { useTranslation } from "@vetta-org/plugin-sdk";
import { type ReactElement } from "react";
import { type UsageBucket } from "../../../proxy-client";
import { paddedBuckets } from "../../../domain/request-health";

/**
 * The per-credential health strip from the CLIProxyAPI panel: one cell per
 * ten-minute window, coloured by what happened in it.
 *
 * Deliberately not scaled by volume — at this size a height ramp is noise. The
 * question a card answers is "is this credential healthy right now", and that is
 * a matter of which windows contain failures.
 */
export function HealthStrip({ buckets }: { buckets: UsageBucket[] }): ReactElement {
  const { t } = useTranslation();
  return (
    <div className="mt-2 flex items-center gap-[3px]" role="img" aria-label={t("console.usageChart")}>
      {paddedBuckets(buckets).map((bucket, index) => {
        const total = bucket.success + bucket.failed;
        const tone = total === 0
          ? "bg-muted-foreground/15"
          : bucket.failed === 0
            ? "bg-emerald-500/80"
            : bucket.success === 0 ? "bg-destructive/80" : "bg-amber-500/80";
        return (
          <span
            key={index}
            title={bucket.time ? `${bucket.time} · ${bucket.success} / ${bucket.failed}` : undefined}
            className={`h-4 flex-1 rounded-[2px] ${tone}`}
          />
        );
      })}
    </div>
  );
}
