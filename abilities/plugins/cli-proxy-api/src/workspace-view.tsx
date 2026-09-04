import { useTranslation } from "@vetta-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "./provider-contract";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";
import { ensureServiceStarted } from "./runtime-provisioner";
import { toDisplayErrorMessage } from "./error-message";
import { ProviderIcon } from "./provider-icon";
import { ActionIcon, Button, Checkbox, ProviderTag, Spin, Toggle } from "./ui-kit";
import { Dialog } from "./dialog";
import { providerForAccount, useProxyConsole } from "./use-proxy-console";
import { readModelSelection, writeModelSelection } from "./model-selection";
import { SERVICE_ID, createProxyClient, type AccountQuota, type ChannelModel, type ProxyAccount, type QuotaWindow, type UsageBucket } from "./proxy-client";

export const WORKSPACE_VIEW_ID = "console";

/** Windows the gateway keeps per credential; a fixed axis keeps every strip aligned. */
const HEALTH_WINDOWS = 20;

function statusLabelKey(phase: ServiceStatus["phase"]): string {
  if (phase === "ready") return "setup.serviceReady";
  if (phase === "failed") return "setup.serviceFailed";
  if (phase === "stopped" || phase === "disabled") return "setup.serviceStopped";
  return "setup.serviceWorking";
}

/**
 * Token limits, in the units their vendor quotes them in.
 *
 * Model context is published in both conventions — 200000 is "200K" and 65536
 * is "64K" — so a single divisor always misreads one of them. Whichever base
 * divides evenly is the one the number was written in.
 */
export function formatTokens(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value >= 1_000_000) {
    return value % 1_048_576 === 0 ? `${value / 1_048_576}M` : `${Math.round((value / 1_000_000) * 100) / 100}M`;
  }
  if (value % 1000 === 0) return `${value / 1000}K`;
  if (value % 1024 === 0) return `${value / 1024}K`;
  if (value >= 1000) return `${Math.round((value / 1000) * 10) / 10}K`;
  return `${value}`;
}

function formatBytes(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

function formatDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toLocaleDateString();
}

function formatMoment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toLocaleString();
}

/** Pads to a fixed axis so a quiet credential still reads as a timeline, not a stub. */
function paddedBuckets(buckets: UsageBucket[]): UsageBucket[] {
  const tail = buckets.slice(-HEALTH_WINDOWS);
  const padding = Array.from({ length: Math.max(0, HEALTH_WINDOWS - tail.length) }, () => ({ time: "", success: 0, failed: 0 }));
  return [...padding, ...tail];
}

/** Adds credential timelines position by position; upstream aligns them by index. */
function mergeBuckets(accounts: ProxyAccount[]): UsageBucket[] {
  const merged: UsageBucket[] = [];
  for (const account of accounts) {
    paddedBuckets(account.recentRequests).forEach((bucket, index) => {
      const current = merged[index];
      if (!current) {
        merged[index] = { ...bucket };
        return;
      }
      current.success += bucket.success;
      current.failed += bucket.failed;
      if (!current.time) current.time = bucket.time;
    });
  }
  return merged;
}

function successRate(success: number, failed: number): number | null {
  const total = success + failed;
  return total === 0 ? null : Math.round((success / total) * 1000) / 10;
}

/**
 * The per-credential health strip from the CLIProxyAPI panel: one cell per
 * ten-minute window, coloured by what happened in it.
 *
 * Deliberately not scaled by volume — at this size a height ramp is noise. The
 * question a card answers is "is this credential healthy right now", and that is
 * a matter of which windows contain failures.
 */
function HealthStrip({ buckets }: { buckets: UsageBucket[] }): ReactElement {
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

/** The page-level chart: request volume per window across every credential. */
function HealthOverview({ accounts }: { accounts: ProxyAccount[] }): ReactElement {
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

/**
 * Says the part the model picker cannot say for itself.
 *
 * Publishing a provider updates the settings on disk, but the running window
 * keeps the model list it read at startup — so a user who just synced goes
 * looking for the models and does not find them. The gateway syncs on its own
 * whenever the service comes up, which is exactly when nobody pressed a button
 * to explain the gap, so this states it at all times and only sharpens after a
 * sync the user asked for.
 */
function ReloadNotice({ syncedModelCount }: { syncedModelCount: number | null }): ReactElement {
  const { t } = useTranslation();
  const synced = syncedModelCount !== null;
  return (
    <div
      role={synced ? "status" : undefined}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 ${synced ? "border-emerald-500/25 bg-emerald-500/10" : "border-border/50 bg-muted/25"}`}
    >
      <span className={`shrink-0 ${synced ? "text-emerald-400" : "text-muted-foreground"}`} aria-hidden="true">ⓘ</span>
      <p className={`min-w-0 flex-1 text-xs leading-relaxed ${synced ? "text-emerald-400" : "text-muted-foreground"}`}>
        {synced ? t("console.reloadNoticeSynced", { count: syncedModelCount }) : t("console.reloadNotice")}
      </p>
    </div>
  );
}

/** Providers park a credential with a JSON error body; only the sentence is useful. */
function readableStatus(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const trimmed = message.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const error = parsed && typeof parsed === "object" ? (parsed as { error?: unknown }).error : undefined;
    const text = error && typeof error === "object" ? (error as { message?: unknown }).message : undefined;
    return typeof text === "string" && text.trim() ? text.trim() : undefined;
  } catch {
    return trimmed;
  }
}

/**
 * Combines what the provider just said with what the gateway had already seen.
 *
 * The live probe carries the limits and the plan; the gateway's own record
 * carries things the usage endpoint never returns — the subscription date it
 * read from the identity token, and when a parked credential is due back.
 */
function mergeQuota(observed: AccountQuota | undefined, probed: AccountQuota | undefined): AccountQuota | undefined {
  if (!probed) return observed;
  if (!observed) return probed;
  return {
    ...probed,
    ...(probed.plan ?? observed.plan ? { plan: probed.plan ?? observed.plan } : {}),
    ...(observed.subscriptionUntil ? { subscriptionUntil: observed.subscriptionUntil } : {}),
    ...(observed.nextRetryAfter ? { nextRetryAfter: observed.nextRetryAfter } : {})
  };
}

/** One limit window: how much is left, and when it comes back. */
function QuotaBar({ window, label, countdown }: {
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

/** Names a limit window by its span, because that is how providers describe them. */
function useWindowLabel(): (minutes: number | undefined) => string {
  const { t } = useTranslation();
  return (minutes) => {
    if (minutes === undefined) return t("console.windowUnknown");
    if (minutes === 10080) return t("console.windowWeekly");
    if (minutes === 1440) return t("console.windowDaily");
    if (minutes % 60 === 0) return t("console.windowHours", { count: minutes / 60 });
    return t("console.windowMinutes", { count: minutes });
  };
}

/** "3 小时后" reads better than a timestamp for something that resets on a clock. */
function useCountdown(): (window: QuotaWindow) => string | undefined {
  const { t } = useTranslation();
  return (window) => {
    const seconds = window.resetInSeconds ?? (window.resetAt
      ? Math.round((new Date(window.resetAt).getTime() - Date.now()) / 1000)
      : undefined);
    if (seconds === undefined || !Number.isFinite(seconds)) return undefined;
    if (seconds <= 0) return t("console.resetNow");
    if (seconds >= 86_400) return t("console.resetInDays", { count: Math.round(seconds / 86_400) });
    if (seconds >= 3600) return t("console.resetInHours", { count: Math.round(seconds / 3600) });
    return t("console.resetInMinutes", { count: Math.max(1, Math.round(seconds / 60)) });
  };
}

/**
 * The provider's own limits for one credential.
 *
 * Rendered from whatever limit headers the gateway last observed — nothing is
 * inferred. A provider that has not answered with them yet simply has no panel,
 * which is honest about the difference between "plenty left" and "not known".
 */
function QuotaPanel({ account, quota, loading, error, onRefresh }: {
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
  if (error && !quota?.windows.length && !quota?.groups?.length) {
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
      {quota.plan || renewal || quota.credits || quota.resetCredits !== undefined ? (
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
    </div>
  );
}

/** One credential, laid out as the CLIProxyAPI panel lays it out. */
function AccountCard({
  account, provider, pending, confirming, removing, disabled, quota, quotaLoading, quotaError,
  onModels, onReset, onToggle, onAskRemove, onCancelRemove, onRemove, onRefreshQuota
}: {
  account: ProxyAccount;
  provider: OAuthProviderId | undefined;
  quota: AccountQuota | undefined;
  quotaLoading: boolean;
  quotaError: string | undefined;
  onRefreshQuota: () => void;
  pending: boolean;
  confirming: boolean;
  removing: boolean;
  disabled: boolean;
  onModels: () => void;
  onReset: () => void;
  onToggle: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const rate = successRate(account.success, account.failed);
  const meta = [formatBytes(account.size), formatMoment(account.modifiedAt ?? account.lastRefresh)].filter(Boolean).join(" · ");
  const status = account.statusMessage && account.statusMessage !== "ok" ? readableStatus(account.statusMessage) : undefined;
  const stateTone = account.disabled
    ? "bg-muted/70 text-muted-foreground"
    : account.active ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400";

  return (
    <article className="flex flex-col rounded-xl border border-border/50 bg-card/30 transition-colors hover:border-border/80">
      <header className="flex items-start gap-2.5 p-3.5 pb-2.5">
        {provider ? <ProviderIcon provider={provider} compact /> : (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold uppercase text-muted-foreground" aria-hidden="true">
            {account.provider.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ProviderTag>{provider ? t(`provider.short.${provider}`) : account.provider}</ProviderTag>
            <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${stateTone}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {t(account.disabled ? "console.disabled" : account.active ? "console.enabled" : "setup.accountUnavailable")}
            </span>
          </div>
          <p className="mt-1.5 truncate text-sm font-medium text-foreground" title={account.displayName}>{account.displayName}</p>
          {account.deleteName && account.deleteName !== account.displayName ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={account.deleteName}>{account.deleteName}</p>
          ) : null}
        </div>
      </header>

      <div className="px-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{t("console.healthStatus")}</span>
          <span className="flex items-baseline gap-2.5 text-[11px] tabular-nums">
            <span className={account.success > 0 ? "text-emerald-400" : "text-muted-foreground"}>{t("console.successCount", { count: account.success })}</span>
            <span className={account.failed > 0 ? "text-destructive" : "text-muted-foreground"}>{t("console.failedCount", { count: account.failed })}</span>
          </span>
        </div>
        <HealthStrip buckets={account.recentRequests} />
        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground">{meta}</p>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">{rate === null ? "—" : `${rate}%`}</span>
        </div>
        {status ? <p className="mt-1 truncate text-[11px] text-amber-400" title={status}>{status}</p> : null}
      </div>

      <QuotaPanel account={account} quota={mergeQuota(account.quota, quota)} loading={quotaLoading} error={quotaError} onRefresh={onRefreshQuota} />

      <footer className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/40 px-3.5 py-2.5">
        {confirming ? (
          <>
            <p className="w-full text-[11px] text-destructive">{t("setup.removeAccountConfirm", { account: account.displayName })}</p>
            <Button className="border-destructive/40 text-destructive hover:bg-destructive/10" disabled={removing} onClick={onRemove}>
              {removing ? <Spin /> : <ActionIcon name="remove" />}{t("setup.confirmRemove")}
            </Button>
            <Button className="border-transparent bg-transparent" disabled={removing} onClick={onCancelRemove}>{t("setup.cancel")}</Button>
          </>
        ) : (
          <>
            <Button onClick={onModels}><ActionIcon name="models" />{t("console.models")}</Button>
            <Button aria-label={`${t("console.resetQuota")} ${account.displayName}`} title={t("console.resetQuota")} disabled={disabled || !account.authIndex} onClick={onReset}>
              {pending ? <Spin /> : <ActionIcon name="reset" />}
            </Button>
            {account.removable ? (
              <Button className="text-destructive hover:bg-destructive/10" aria-label={`${t("setup.removeAccount")} ${account.displayName}`} title={t("setup.removeAccount")} disabled={disabled} onClick={onAskRemove}>
                <ActionIcon name="remove" />
              </Button>
            ) : null}
            <span className="ml-auto flex items-center">
              <Toggle
                checked={!account.disabled}
                disabled={disabled}
                label={`${t(account.disabled ? "console.enable" : "console.disable")} ${account.displayName}`}
                onChange={onToggle}
              />
            </span>
          </>
        )}
      </footer>
    </article>
  );
}

/** Shows what one credential can serve, on demand — the grid stays about health. */
function ModelDialog({
  account, models, loading, error, onClose
}: {
  account: ProxyAccount;
  models: ChannelModel[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return models;
    return models.filter((model) => `${model.id} ${model.displayName ?? ""}`.toLowerCase().includes(needle));
  }, [models, query]);

  return (
    <Dialog title={t("console.modelsTitle")} description={account.displayName} onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">{t("console.modelCount", { count: models.length })}</span>
          <Button onClick={onClose}>{t("setup.close")}</Button>
        </div>
      }
    >
      {models.length > 8 ? (
        <div className="sticky top-0 border-b border-border/40 bg-card/95 px-4 py-2 backdrop-blur">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("console.filterModels")}
            aria-label={t("console.filterModels")}
            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/60"
          />
        </div>
      ) : null}
      {loading ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground"><Spin /> {t("console.loadingModels")}</p>
      ) : error ? (
        <p className="px-4 py-6 text-center text-xs text-destructive" role="alert">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t(models.length === 0 ? "console.noModels" : "console.noMatches")}</p>
      ) : (
        <ul className="divide-y divide-border/30">
          {filtered.map((model) => {
            const context = formatTokens(model.contextWindow);
            const output = formatTokens(model.maxTokens);
            return (
              <li key={model.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px] text-foreground">{model.id}</span>
                  {model.displayName && model.displayName !== model.id ? (
                    <span className="block truncate text-[11px] text-muted-foreground">{model.displayName}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground">
                  {model.reasoning ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{t("console.reasoning")}</span> : null}
                  {context ? <span className="rounded bg-muted/60 px-1.5 py-0.5">{t("console.context", { value: context })}</span> : null}
                  {output ? <span className="rounded bg-muted/60 px-1.5 py-0.5">{t("console.output", { value: output })}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

/** The provider picker; authorizing is a deliberate act, not a permanent toolbar. */
function ConnectDialog({ onClose, onPick, disabled }: {
  onClose: () => void;
  onPick: (provider: OAuthProviderId) => void;
  disabled: boolean;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <Dialog title={t("console.addAccount")} description={t("setup.oauthDescription")} onClose={onClose}>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {OAUTH_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(provider.id)}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3 text-left transition-colors hover:border-border hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ProviderIcon provider={provider.id} compact />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{t(`provider.${provider.id}`)}</span>
              <span className="block text-[11px] text-muted-foreground">{provider.deviceFlow ? t("setup.deviceFlow") : t("setup.browserFlow")}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/** What one credential answered when asked for its models. */
export type ModelGroupState = { models: ChannelModel[]; error?: string };

/** One credential's models, as tick boxes. */
function ModelGroup({ account, provider, state, selected, onToggle, onGroup }: {
  account: ProxyAccount;
  provider: OAuthProviderId | undefined;
  state: ModelGroupState;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onGroup: (ids: string[], next: boolean) => void;
}): ReactElement {
  const { t } = useTranslation();
  const models = state.models;
  const ids = models.map((model) => model.id);
  const picked = ids.filter((id) => selected.has(id)).length;
  const all = picked === ids.length && ids.length > 0;

  return (
    <section className="rounded-xl border border-border/50 bg-card/25" aria-label={account.displayName}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
        <Checkbox
          checked={all}
          disabled={ids.length === 0}
          label={t(all ? "console.clearGroup" : "console.selectGroup", { account: account.displayName })}
          onChange={() => onGroup(ids, !all)}
        />
        <ProviderTag>{provider ? t(`provider.short.${provider}`) : account.provider}</ProviderTag>
        <span className="min-w-0 truncate text-xs text-foreground" title={account.displayName}>{account.displayName}</span>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {t("console.groupCount", { picked, total: ids.length })}
        </span>
      </header>
      {state.error ? (
        <p className="px-3 py-2.5 text-[11px] text-destructive" role="alert">
          {t("console.groupFailed", { details: state.error })}
        </p>
      ) : models.length === 0 ? (
        <p className="px-3 py-2.5 text-[11px] text-muted-foreground">{t("console.groupEmpty")}</p>
      ) : (
      <div className="grid gap-x-4 gap-y-1 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {models.map((model) => {
          const context = formatTokens(model.contextWindow);
          return (
            <label key={model.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40">
              <Checkbox checked={selected.has(model.id)} label={model.id} onChange={() => onToggle(model.id)} />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={model.displayName ?? model.id}>
                {model.id}
              </span>
              {model.reasoning ? <span className="shrink-0 rounded bg-primary/10 px-1 text-[10px] text-primary">{t("console.reasoning")}</span> : null}
              {context ? <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{context}</span> : null}
            </label>
          );
        })}
      </div>
      )}
    </section>
  );
}

/**
 * Chooses what the gateway publishes into Vetta.
 *
 * Grouped by credential because that is how the models are actually reached — a
 * model is only routable while the account behind it is connected and healthy,
 * so a flat list would hide the thing that decides whether it works.
 *
 * Applying replaces the published set outright rather than merging: the ticked
 * boxes are what the picker will contain, which is the only rule that stays
 * predictable once accounts come and go.
 */
function ModelPicker({
  accounts, accountModels, loading, selected, setSelected, onApply, applying
}: {
  accounts: ProxyAccount[];
  accountModels: ReadonlyMap<string, ModelGroupState>;
  loading: boolean;
  selected: ReadonlySet<string>;
  setSelected: (next: ReadonlySet<string>) => void;
  onApply: () => void;
  applying: boolean;
}): ReactElement {
  const { t } = useTranslation();
  const everyId = useMemo(() => {
    const ids = new Set<string>();
    for (const group of accountModels.values()) for (const model of group.models) ids.add(model.id);
    return ids;
  }, [accountModels]);
  const pickedCount = [...everyId].filter((id) => selected.has(id)).length;

  const toggle = (id: string): void => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const setGroup = (ids: string[], on: boolean): void => {
    const next = new Set(selected);
    for (const id of ids) if (on) next.add(id); else next.delete(id);
    setSelected(next);
  };

  return (
    <section className="space-y-3" aria-labelledby="cpa-models-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p id="cpa-models-title" className="text-sm font-semibold text-foreground">{t("console.pickerTitle")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("console.pickerSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {t("console.selectedCount", { picked: pickedCount, total: everyId.size })}
          </span>
          <Button disabled={everyId.size === 0} onClick={() => setSelected(new Set(everyId))}>{t("console.selectAll")}</Button>
          <Button disabled={pickedCount === 0} onClick={() => setSelected(new Set())}>{t("console.clearAll")}</Button>
          <Button
            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            disabled={applying || loading || everyId.size === 0}
            onClick={onApply}
          >
            {applying ? <Spin /> : <ActionIcon name="app-reload" />}{t("console.apply")}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="rounded-xl border border-border/50 px-4 py-6 text-center text-xs text-muted-foreground">
          <Spin /> {t("console.loadingModels")}
        </p>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <ModelGroup
              key={account.key}
              account={account}
              provider={providerForAccount(account)}
              state={accountModels.get(account.key) ?? { models: [] }}
              selected={selected}
              onToggle={toggle}
              onGroup={setGroup}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The CLIProxyAPI console: every credential as a card, health first.
 *
 * The ability detail slot is where the gateway gets set up; this page is where
 * you live with it. That is why it is a grid of credentials rather than a list
 * of channels — what goes wrong day to day goes wrong per account — and why the
 * model lists sit behind a button: they are long, rarely the question, and would
 * otherwise bury the health signal the grid exists to show.
 */
export function ProxyWorkspaceView({ context: pluginContext }: { context: ManagedPluginContext }): ReactElement {
  const { t } = useTranslation();
  const {
    status, accounts, models, catalog, busy, flow, error, setError,
    refreshing, syncing, syncedModelCount, startingOAuth,
    removalCandidate, setRemovalCandidate, removingAccount, pendingAccount, quotas, quotaLoading, quotaErrors, loadQuota,
    refresh, startOAuth, cancelOAuth, dismissFlow, removeAccount, toggleAccount, resetQuota
  } = useProxyConsole(pluginContext);

  const client = useMemo(() => createProxyClient(pluginContext), [pluginContext]);
  const [connecting, setConnecting] = useState(false);
  const [modelAccount, setModelAccount] = useState<ProxyAccount | null>(null);
  const [accountModels, setAccountModels] = useState<ChannelModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [groupedModels, setGroupedModels] = useState<ReadonlyMap<string, ModelGroupState>>(new Map());
  const [pickerLoading, setPickerLoading] = useState(true);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  /**
   * Whether the stored selection has been read.
   *
   * A ref, not state: the loader effect re-runs whenever the catalog changes,
   * and a stale `false` in its closure would take the first-load branch again
   * and re-tick every model — quietly undoing what the user had just cleared.
   */
  const selectionLoaded = useRef(false);
  /** Model ids the picker has already offered; anything new is opted in. */
  const knownIds = useRef<ReadonlySet<string>>(new Set());
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);

  // One read per credential, refreshed whenever the set of credentials changes.
  const accountKeys = accounts.map((account) => account.key).join("|");
  useEffect(() => {
    let active = true;
    if (accounts.length === 0) {
      setGroupedModels(new Map());
      setPickerLoading(false);
      return () => { active = false; };
    }
    setPickerLoading(true);
    void Promise.all(accounts.map(async (account): Promise<readonly [string, ModelGroupState]> => {
      try {
        return [account.key, { models: await client.fetchAccountModels(account, catalog ?? undefined) }] as const;
      } catch (reason) {
        // Kept as a group with an error rather than dropped: a credential that
        // will not answer is exactly what the user needs to be told about.
        return [account.key, { models: [], error: toDisplayErrorMessage(reason) }] as const;
      }
    })).then((entries) => {
      if (!active) return;
      const next = new Map(entries);
      const every = new Set([...next.values()].flatMap((group) => group.models).map((model) => model.id));
      setGroupedModels(next);
      setPickerLoading(false);
      // Nothing chosen yet means "publish everything", which is what the gateway
      // did before this picker existed — so start with every box ticked.
      if (!selectionLoaded.current) {
        void readModelSelection(pluginContext).then((stored) => {
          if (!active) return;
          knownIds.current = every;
          setSelected(stored ?? every);
          selectionLoaded.current = true;
        });
        return;
      }
      // A model the picker has never shown is ticked by default: authorizing an
      // account is a request for its models, not an invitation to hunt for them.
      const fresh = [...every].filter((id) => !knownIds.current.has(id));
      knownIds.current = every;
      if (fresh.length > 0) setSelected((current) => new Set([...current, ...fresh]));
    });
    return () => { active = false; };
  }, [accountKeys, catalog, client]);

  const applySelection = useCallback(async (): Promise<void> => {
    setConfirmApply(false);
    setApplying(true);
    try {
      await writeModelSelection(pluginContext, selected);
      await client.publishModels(models, () => true, selected);
      // The picker is only true once the window re-reads the model settings.
      window.location.reload();
    } catch (reason) {
      setApplying(false);
      // Surfaced on the page, not in the model dialog: apply is a page-level action.
      setError(t("console.applyFailed", { details: toDisplayErrorMessage(reason) }));
    }
  }, [client, models, pluginContext, selected, setError, t]);

  const openModels = useCallback((account: ProxyAccount): void => {
    setModelAccount(account);
    setAccountModels([]);
    setModelsError(null);
    setModelsLoading(true);
    void client.fetchAccountModels(account, catalog ?? undefined)
      .then(setAccountModels)
      .catch((reason: unknown) => setModelsError(toDisplayErrorMessage(reason)))
      .finally(() => setModelsLoading(false));
  }, [catalog, client]);

  const locked = status.phase !== "ready" || flow?.phase === "waiting" || pendingAccount !== null || removingAccount !== null;

  // The host header owns the window drag region; filling it keeps this page from
  // stacking a second toolbar under the app title.
  useEffect(() => {
    pluginContext.ui.setWorkspaceViewHeader(WORKSPACE_VIEW_ID, {
      title: "%console.title%",
      right: (
        <div className="flex items-center gap-2">
          {status.phase === "ready" ? (
            <>
              <Button className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" disabled={refreshing} onClick={() => void refresh(true)}>
                {syncing ? <Spin /> : <ActionIcon name="sync" />}
                {t(syncing ? "setup.syncingModels" : "setup.syncModels")}
              </Button>
              <Button aria-label={t("setup.restart")} title={t("setup.restart")} onClick={() => void pluginContext.services.restart(SERVICE_ID)}>
                <ActionIcon name="restart" />
              </Button>
              <Button aria-label={t("console.reloadApp")} title={t("console.reloadAppHint")} onClick={() => window.location.reload()}>
                <ActionIcon name="app-reload" />{t("console.reloadApp")}
              </Button>
            </>
          ) : (
            <Button className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" disabled={busy} onClick={() => void ensureServiceStarted(pluginContext).catch(() => undefined)}>
              {busy ? <Spin /> : null}{t("setup.start")}
            </Button>
          )}
        </div>
      )
    });
    return () => pluginContext.ui.setWorkspaceViewHeader(WORKSPACE_VIEW_ID, null);
  }, [busy, refresh, refreshing, status.phase, syncing, t]);

  return (
    <div className="h-full overflow-y-auto" aria-live="polite">
      <div className="mx-auto max-w-6xl space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.phase === "ready" ? "bg-emerald-500/15 text-emerald-400" : status.phase === "failed" ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
            {busy ? <Spin /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
            {t(statusLabelKey(status.phase))}
          </span>
          <span className="rounded-md bg-muted/40 px-2 py-1 text-[11px] tabular-nums text-muted-foreground">{t("setup.runtimeVersion", { version: status.version })}</span>
          <span className="rounded-md bg-muted/40 px-2 py-1 text-[11px] tabular-nums text-muted-foreground">{t("setup.routesDiscovered", { count: models.length })}</span>
        </div>

        <ReloadNotice syncedModelCount={syncedModelCount} />

        {error ? <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{error}</p> : null}

        {accounts.length > 0 ? <HealthOverview accounts={accounts} /> : null}

        {flow ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-3">
              <ProviderIcon provider={flow.provider} compact />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{t(`provider.${flow.provider}`)}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {flow.phase === "waiting" ? t("setup.oauthWaiting") : flow.phase === "success" ? t("setup.oauthSuccess") : flow.error}
                </p>
                {flow.userCode ? <p className="mt-2 inline-flex rounded-md bg-background/70 px-3 py-1.5 font-mono text-base font-semibold tracking-widest text-foreground">{flow.userCode}</p> : null}
                <div className="mt-3 flex gap-2">
                  {flow.phase === "waiting" ? (
                    <>
                      <Button onClick={() => void pluginContext.ui.openExternal(flow.url)}><ActionIcon name="open" />{t("setup.openAuth")}</Button>
                      <Button className="border-transparent bg-transparent" onClick={() => void cancelOAuth()}>{t("setup.cancel")}</Button>
                    </>
                  ) : (
                    <Button className="border-transparent bg-transparent" onClick={dismissFlow}>{t("setup.close")}</Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{t("console.accountsTitle")}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t("console.subtitle")}</p>
          </div>
          <Button
            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            disabled={status.phase !== "ready" || startingOAuth || flow?.phase === "waiting"}
            onClick={() => setConnecting(true)}
          >
            {startingOAuth ? <Spin /> : <ActionIcon name="plus" />}{t("console.addAccount")}
          </Button>
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">{t("console.noAccounts")}</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{t("console.noAccountsHint")}</p>
          </div>
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.key}
                account={account}
                provider={providerForAccount(account)}
                pending={pendingAccount === account.key}
                quota={quotas.get(account.key)}
                quotaLoading={quotaLoading.has(account.key)}
                quotaError={quotaErrors.get(account.key)}
                onRefreshQuota={() => void loadQuota(account, true)}
                confirming={removalCandidate === account.key}
                removing={removingAccount === account.key}
                disabled={locked}
                onModels={() => openModels(account)}
                onReset={() => void resetQuota(account)}
                onToggle={() => void toggleAccount(account)}
                onAskRemove={() => setRemovalCandidate(account.key)}
                onCancelRemove={() => setRemovalCandidate(null)}
                onRemove={() => void removeAccount(account)}
              />
            ))}
          </div>
        )}

        {accounts.length > 0 ? (
          <ModelPicker
            accounts={accounts}
            accountModels={groupedModels}
            loading={pickerLoading}
            selected={selected}
            setSelected={setSelected}
            applying={applying}
            onApply={() => setConfirmApply(true)}
          />
        ) : null}

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <span className="mt-px" aria-hidden="true">ⓘ</span>{t("setup.removeLocalOnly")}
        </p>

        {status.recentOutput ? (
          <details className="rounded-lg border border-border/40 bg-card/15 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">{t("setup.diagnostics")}</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-2 font-mono text-[11px]">{status.recentOutput}</pre>
          </details>
        ) : null}
      </div>

      {connecting ? (
        <ConnectDialog
          disabled={startingOAuth}
          onClose={() => setConnecting(false)}
          onPick={(id) => {
            const definition = OAUTH_PROVIDERS.find((provider) => provider.id === id);
            setConnecting(false);
            if (definition) void startOAuth(definition);
          }}
        />
      ) : null}

      {confirmApply ? (
        <Dialog
          title={t("console.applyConfirmTitle")}
          onClose={() => setConfirmApply(false)}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button className="border-transparent bg-transparent" onClick={() => setConfirmApply(false)}>{t("setup.cancel")}</Button>
              <Button className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" onClick={() => void applySelection()}>
                <ActionIcon name="app-reload" />{t("console.applyAndReload")}
              </Button>
            </div>
          }
        >
          <p className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
            {t("console.applyConfirmBody", { count: selected.size })}
          </p>
        </Dialog>
      ) : null}

      {modelAccount ? (
        <ModelDialog
          account={modelAccount}
          models={accountModels}
          loading={modelsLoading}
          error={modelsError}
          onClose={() => setModelAccount(null)}
        />
      ) : null}
    </div>
  );
}
