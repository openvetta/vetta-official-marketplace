import { useTranslation } from "@vetta-org/plugin-sdk";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { MODEL_CHANNEL_BY_PROVIDER, OAUTH_PROVIDERS, type OAuthProviderId } from "./provider-contract";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";
import { ensureServiceStarted } from "./runtime-provisioner";
import { toDisplayErrorMessage } from "./error-message";
import { ProviderIcon } from "./provider-icon";
import { ActionIcon, Button, Spin } from "./ui-kit";
import { useProxyConsole } from "./use-proxy-console";
import { SERVICE_ID, type ChannelModel, type ProxyAccount, type ProxyModel, type UsageBucket } from "./proxy-client";

export const WORKSPACE_VIEW_ID = "console";

/** One channel as the page renders it: its accounts, its health and what it can route. */
type ChannelSummary = {
  provider: OAuthProviderId;
  deviceFlow: boolean;
  accounts: ProxyAccount[];
  activeCount: number;
  success: number;
  failed: number;
  buckets: UsageBucket[];
  /** Everything the channel advertises, whether or not a credential is connected. */
  supported: ChannelModel[];
  /** Ids currently routable through `/v1/models`. */
  live: Set<string>;
};

function statusLabelKey(phase: ServiceStatus["phase"]): string {
  if (phase === "ready") return "setup.serviceReady";
  if (phase === "failed") return "setup.serviceFailed";
  if (phase === "stopped" || phase === "disabled") return "setup.serviceStopped";
  return "setup.serviceWorking";
}

/** 1048576 → "1M". Model limits are only ever read as an order of magnitude. */
function formatTokens(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value >= 1_000_000) return `${Math.round((value / 1_048_576) * 10) / 10}M`;
  if (value >= 1000) return `${Math.round(value / 1024)}K`;
  return `${value}`;
}

/**
 * Sums the per-credential buckets of one channel position by position.
 *
 * Upstream hands every credential the same 20 ten-minute windows, so the bars
 * only line up if they are added by index rather than by label.
 */
function mergeBuckets(accounts: ProxyAccount[]): UsageBucket[] {
  const merged: UsageBucket[] = [];
  for (const account of accounts) {
    account.recentRequests.forEach((bucket, index) => {
      const current = merged[index];
      if (!current) {
        merged[index] = { ...bucket };
        return;
      }
      current.success += bucket.success;
      current.failed += bucket.failed;
    });
  }
  return merged;
}

/** Request volume over the recent windows; red marks the windows that had failures. */
function Sparkline({ buckets }: { buckets: UsageBucket[] }): ReactElement | null {
  const { t } = useTranslation();
  if (buckets.length === 0) return null;
  const peak = Math.max(...buckets.map((bucket) => bucket.success + bucket.failed), 1);
  return (
    <div className="flex h-8 items-end gap-px" role="img" aria-label={t("console.usageChart")}>
      {buckets.map((bucket, index) => {
        const total = bucket.success + bucket.failed;
        return (
          <span
            key={`${bucket.time}:${index}`}
            title={`${bucket.time} · ${bucket.success} / ${bucket.failed}`}
            className={`w-1.5 rounded-sm ${total === 0 ? "bg-muted" : bucket.failed > 0 ? "bg-destructive/70" : "bg-emerald-500/70"}`}
            style={{ height: `${total === 0 ? 8 : Math.max(12, (total / peak) * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

function HealthPill({ account }: { account: ProxyAccount }): ReactElement {
  const { t } = useTranslation();
  const total = account.success + account.failed;
  const rate = total === 0 ? null : Math.round((account.success / total) * 100);
  const tone = !account.active
    ? "bg-amber-500/10 text-amber-400"
    : rate !== null && rate < 80
      ? "bg-destructive/10 text-destructive"
      : "bg-emerald-500/10 text-emerald-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {!account.active
        ? t("setup.accountUnavailable")
        : rate === null
          ? t("setup.accountActive")
          : t("console.successRate", { rate })}
    </span>
  );
}

function ModelRow({ model, live }: { model: ChannelModel; live: boolean }): ReactElement {
  const { t } = useTranslation();
  const context = formatTokens(model.contextWindow);
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? "bg-emerald-400" : "bg-muted-foreground/30"}`} aria-hidden="true" />
      <span className="min-w-0 truncate font-mono text-[11px] text-foreground">{model.id}</span>
      {model.displayName && model.displayName !== model.id ? (
        <span className="min-w-0 truncate text-muted-foreground">{model.displayName}</span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        {model.reasoning ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{t("console.reasoning")}</span> : null}
        {context ? <span className="rounded bg-muted/60 px-1.5 py-0.5">{t("console.context", { value: context })}</span> : null}
        {!live ? <span className="rounded bg-muted/40 px-1.5 py-0.5">{t("console.notRouted")}</span> : null}
      </span>
    </li>
  );
}

function ChannelCard({
  summary, disabled, busy, onConnect, onRemove, removalCandidate, setRemovalCandidate, removingAccount
}: {
  summary: ChannelSummary;
  disabled: boolean;
  busy: boolean;
  onConnect: () => void;
  onRemove: (account: ProxyAccount) => void;
  removalCandidate: string | null;
  setRemovalCandidate: (key: string | null) => void;
  removingAccount: string | null;
}): ReactElement {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const providerName = t(`provider.${summary.provider}`);
  const total = summary.success + summary.failed;
  const listed = expanded ? summary.supported : summary.supported.slice(0, 5);

  return (
    <section className="rounded-xl border border-border/50 bg-card/25 transition-colors hover:border-border">
      <div className="flex flex-wrap items-start justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderIcon provider={summary.provider} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{providerName}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {summary.accounts.length > 0
                ? t("setup.accountStatus", { active: summary.activeCount, unavailable: summary.accounts.length - summary.activeCount })
                : summary.deviceFlow ? t("setup.deviceFlow") : t("setup.browserFlow")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 ? <Sparkline buckets={summary.buckets} /> : null}
          <Button className="shrink-0" aria-label={`${t(summary.accounts.length > 0 ? "setup.addOrReplace" : "setup.connect")} ${providerName}`} disabled={disabled} onClick={onConnect}>
            {busy ? <Spin /> : null}
            {t(summary.accounts.length > 0 ? "setup.addOrReplace" : "setup.connect")}
          </Button>
        </div>
      </div>

      {total > 0 ? (
        <p className="border-t border-border/40 px-3 py-2 text-[11px] text-muted-foreground">
          {t("console.channelRequests", { success: summary.success, failed: summary.failed })}
        </p>
      ) : null}

      {summary.accounts.length > 0 ? (
        <ul className="divide-y divide-border/40 border-t border-border/40">
          {summary.accounts.map((account) => {
            const confirming = removalCandidate === account.key;
            const removing = removingAccount === account.key;
            return (
              <li key={account.key} className="px-3 py-2.5 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{account.displayName}</p>
                    <p className="mt-0.5 text-[11px]">
                      {account.statusMessage ?? account.status ?? t("console.noRequests")}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <HealthPill account={account} />
                    {account.removable ? (
                      confirming ? (
                        <>
                          <Button className="border-destructive/40 text-destructive hover:bg-destructive/10" disabled={removing} onClick={() => onRemove(account)}>
                            {removing ? <Spin /> : <ActionIcon name="remove" />}{t("setup.confirmRemove")}
                          </Button>
                          <Button className="border-transparent bg-transparent" disabled={removing} onClick={() => setRemovalCandidate(null)}>{t("setup.cancel")}</Button>
                        </>
                      ) : (
                        <Button className="border-transparent bg-transparent text-muted-foreground hover:text-foreground" aria-label={`${t("setup.removeAccount")} ${account.displayName}`} disabled={removingAccount !== null} onClick={() => setRemovalCandidate(account.key)}>
                          <ActionIcon name="remove" />
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {summary.supported.length > 0 ? (
        <div className="border-t border-border/40">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              {t("console.supportedModels", { live: summary.live.size, total: summary.supported.length })}
            </p>
            {summary.supported.length > 5 ? (
              <Button className="border-transparent bg-transparent text-[11px] text-muted-foreground hover:text-foreground" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
                {t(expanded ? "console.collapse" : "console.expand")}
              </Button>
            ) : null}
          </div>
          <ul className="divide-y divide-border/30 border-t border-border/30">
            {listed.map((model) => <ModelRow key={model.id} model={model} live={summary.live.has(model.id)} />)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The gateway console: one full page that configures every channel, states what
 * each one can route and how it is behaving.
 *
 * The ability detail slot stays the place you set the gateway up; this page is
 * where you live with it afterwards, which is why it is organised per channel
 * rather than per task.
 */
export function ProxyWorkspaceView({ context: pluginContext }: { context: ManagedPluginContext }): ReactElement {
  const { t } = useTranslation();
  const {
    status, models, catalog, accountsByProvider, busy, flow, error,
    refreshing, syncing, syncedModelCount, startingOAuth,
    removalCandidate, setRemovalCandidate, removingAccount,
    refresh, startOAuth, cancelOAuth, dismissFlow, removeAccount
  } = useProxyConsole(pluginContext);

  const liveByChannel = useMemo(() => {
    const byId = new Map<string, ProxyModel>(models.map((model) => [model.id, model]));
    return byId;
  }, [models]);

  const channels = useMemo<ChannelSummary[]>(() => OAUTH_PROVIDERS.map((provider) => {
    const accounts = accountsByProvider.get(provider.id) ?? [];
    const supported = catalog?.channels.get(MODEL_CHANNEL_BY_PROVIDER[provider.id]) ?? [];
    return {
      provider: provider.id,
      deviceFlow: provider.deviceFlow,
      accounts,
      activeCount: accounts.filter((account) => account.active).length,
      success: accounts.reduce((sum, account) => sum + account.success, 0),
      failed: accounts.reduce((sum, account) => sum + account.failed, 0),
      buckets: mergeBuckets(accounts),
      supported,
      live: new Set(supported.filter((model) => liveByChannel.has(model.id)).map((model) => model.id))
    };
  }), [accountsByProvider, catalog, liveByChannel]);

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
              <Button onClick={() => void pluginContext.services.restart(SERVICE_ID)}><ActionIcon name="restart" />{t("setup.restart")}</Button>
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
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.phase === "ready" ? "bg-emerald-500/15 text-emerald-400" : status.phase === "failed" ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
            {busy ? <Spin /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
            {t(statusLabelKey(status.phase))}
          </span>
          <span className="rounded-md bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">{t("setup.runtimeVersion", { version: status.version })}</span>
          <span className="rounded-md bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">{t("setup.routesDiscovered", { count: models.length })}</span>
          {syncedModelCount !== null ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-400" role="status">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {t("setup.syncSuccess", { count: syncedModelCount })}
            </span>
          ) : null}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">{t("console.subtitle")}</p>

        {error ? <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{error}</p> : null}

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

        <div className="space-y-3">
          {channels.map((summary) => (
            <ChannelCard
              key={summary.provider}
              summary={summary}
              disabled={status.phase !== "ready" || startingOAuth || flow?.phase === "waiting" || removingAccount !== null}
              busy={startingOAuth}
              onConnect={() => {
                const definition = OAUTH_PROVIDERS.find((provider) => provider.id === summary.provider);
                if (definition) void startOAuth(definition);
              }}
              onRemove={(account) => void removeAccount(account)}
              removalCandidate={removalCandidate}
              setRemovalCandidate={setRemovalCandidate}
              removingAccount={removingAccount}
            />
          ))}
        </div>

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
    </div>
  );
}
