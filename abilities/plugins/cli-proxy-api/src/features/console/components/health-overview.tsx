import { useTranslation } from "@vetta-org/plugin-sdk";
import { useMemo, type ReactElement } from "react";
import { type ProxyAccount } from "../../../proxy-client";
import { HEALTH_WINDOWS } from "../../../domain/request-health";
import { mergeBuckets } from "../../../domain/request-health";
import { successRate } from "../../../domain/request-health";

/** The page-level chart: request volume per window across every credential. */
export function HealthOverview({ accounts }: { accounts: ProxyAccount[] }): ReactElement {
  const { t } = useTranslation();
  const buckets = useMemo(() => mergeBuckets(accounts), [accounts]);
  const success = accounts.reduce((sum, account) => sum + account.success, 0);
  const failed = accounts.reduce((sum, account) => sum + account.failed, 0);
  const rate = successRate(success, failed);
  const peak = Math.max(...buckets.map((bucket) => bucket.success + bucket.failed), 1);

  return (
    <section className="grid gap-4 rounded-xl border border-border/50 bg-card/30 p-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-center" aria-labelledby="cpa-health-title">
      <div>
        <p id="cpa-health-title" className="text-xs font-medium text-muted-foreground">{t("console.healthOverview")}</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums leading-none text-foreground">{rate === null ? "—" : `${rate}%`}</span>
          <span className="text-xs text-muted-foreground">{t("console.successRateLabel")}</span>
        </p>
        <p className="mt-2 flex items-baseline gap-3 text-xs tabular-nums">
          <span className="text-emerald-400">{t("console.successCount", { count: success })}</span>
          <span className={failed > 0 ? "text-destructive" : "text-muted-foreground"}>{t("console.failedCount", { count: failed })}</span>
        </p>
      </div>
      <div>
        <div className="flex h-20 items-end gap-1.5" role="img" aria-label={t("console.usageChart")}>
          {buckets.map((bucket, index) => {
            const total = bucket.success + bucket.failed;
            const height = total === 0 ? 4 : Math.max(12, Math.round((total / peak) * 100));
            return (
              <span
                key={index}
                title={bucket.time ? `${bucket.time} · ${bucket.success} / ${bucket.failed}` : undefined}
                className="flex flex-1 flex-col justify-end overflow-hidden rounded-[3px]"
                style={{ height: `${height}%` }}
              >
                {bucket.failed > 0 ? (
                  <span className="w-full bg-destructive/80" style={{ height: `${Math.round((bucket.failed / total) * 100)}%` }} />
                ) : null}
                <span className={`w-full flex-1 ${total === 0 ? "bg-muted-foreground/15" : "bg-emerald-500/70"}`} />
              </span>
            );
          })}
        </div>
        <p className="mt-1.5 text-right text-[10px] text-muted-foreground">{t("console.windowAxis", { count: HEALTH_WINDOWS })}</p>
      </div>
    </section>
  );
}
