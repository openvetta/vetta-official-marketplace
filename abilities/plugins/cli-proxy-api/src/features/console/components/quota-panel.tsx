import { useTranslation } from "@vetta-org/plugin-sdk";
import { type ReactElement } from "react";
import { Spin } from "../../../shared/components/spin";
import { type AccountQuota, type ProxyAccount } from "../../../proxy-client";
import { formatDay } from "../../../domain/console-format";
import { formatMoment } from "../../../domain/console-format";
import { QuotaBar } from "./quota-bar";
import { useWindowLabel } from "../hooks/use-quota-time";
import { useCountdown } from "../hooks/use-quota-time";

/**
 * The provider's own limits for one credential.
 *
 * Rendered from whatever limit headers the gateway last observed — nothing is
 * inferred. A provider that has not answered with them yet simply has no panel,
 * which is honest about the difference between "plenty left" and "not known".
 */
export function QuotaPanel({ account, quota, loading, error, onRefresh }: {
  account: ProxyAccount;
  quota: AccountQuota | undefined;
  loading: boolean;
  error: string | undefined;
  onRefresh: () => void;
}): ReactElement | null {
  const { t } = useTranslation();
  const label = useWindowLabel();
  const countdown = useCountdown();
  if (loading && !quota) {
    return (
      <p className="mx-3.5 mb-3 rounded-lg border border-border/40 px-3 py-2 text-[11px] text-muted-foreground">
        <Spin /> {t("console.quotaLoading")}
      </p>
    );
  }
  if (error && !quota?.windows.length && !quota?.groups?.length && !quota?.summary?.length) {
    return (
      <div className="mx-3.5 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/40 px-3 py-2">
        <p className="min-w-0 flex-1 text-[11px] text-amber-400" role="alert">{t("console.quotaFailed", { details: error })}</p>
        <button type="button" className="shrink-0 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={onRefresh}>
          {t("console.quotaRefresh")}
        </button>
      </div>
    );
  }
  if (!quota) return null;
  const renewal = formatDay(quota.subscriptionUntil);
  const retry = quota.nextRetryAfter ? formatMoment(quota.nextRetryAfter) : undefined;

  return (
    <div className="mx-3.5 mb-3 rounded-lg border border-border/40 bg-background/30 px-3 py-2.5">
      {(
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {quota.plan ? (
            <span className="rounded bg-muted/60 px-1.5 py-0.5 font-medium uppercase tracking-wide text-foreground">
              {t("console.plan", { plan: quota.plan })}
            </span>
          ) : null}
          {renewal ? <span className="tabular-nums text-muted-foreground">{t("console.renewsOn", { date: renewal })}</span> : null}
          {quota.credits ? (
            <span className="tabular-nums text-muted-foreground">
              {quota.credits.unlimited ? t("console.creditsUnlimited") : t("console.credits", { count: quota.credits.balance ?? 0 })}
            </span>
          ) : null}
          {quota.resetCredits !== undefined ? (
            <span className="tabular-nums text-muted-foreground">{t("console.resetCredits", { count: quota.resetCredits })}</span>
          ) : null}
          <button
            type="button"
            className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
            disabled={loading}
            onClick={onRefresh}
          >
            {loading ? <Spin /> : t("console.quotaRefresh")}
          </button>
        </div>
      )}

      {quota.summary?.length ? (
        <dl className="mt-2 space-y-1 text-[11px]">
          {quota.summary.map((metric) => (
            <div key={metric.key} className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{metric.label}</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {new Intl.NumberFormat(undefined, metric.format === "currency" && metric.currency
                  ? { style: "currency", currency: metric.currency } : { maximumFractionDigits: 2 }).format(metric.value)}
                {metric.format !== "currency" && metric.unit ? ` ${metric.unit}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {quota.windows.map((window, index) => <QuotaBar key={index} window={window} label={label} countdown={countdown} />)}

      {quota.groups?.map((group, index) => (
        <div key={index} className={index > 0 ? "mt-3 border-t border-border/40 pt-2" : "mt-2"}>
          <p className="text-[11px] font-medium text-foreground">{group.name}</p>
          {group.description ? <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{group.description}</p> : null}
          {group.windows.map((window, position) => <QuotaBar key={position} window={window} label={label} countdown={countdown} />)}
        </div>
      ))}

      {retry ? <p className="mt-2 text-[11px] tabular-nums text-amber-400">{t("console.retryAfter", { time: retry })}</p> : null}
      {error ? <p className="mt-2 text-[11px] text-amber-400" role="alert">{t("console.quotaFailed", { details: error })}</p> : null}
    </div>
  );
}
