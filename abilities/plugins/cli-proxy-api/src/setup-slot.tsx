import { useTranslation } from "@vetta-org/plugin-sdk";
import type { ReactElement } from "react";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "./provider-contract";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";
import { ensureServiceStarted } from "./runtime-provisioner";
import { toDisplayErrorMessage } from "./error-message";
import { ProviderIcon } from "./provider-icon";
import { ActionIcon, Button, ServiceIcon, Spin } from "./ui-kit";
import { providerForAccount, useProxyConsole } from "./use-proxy-console";
import { SERVICE_ID } from "./proxy-client";

function statusLabelKey(phase: ServiceStatus["phase"]): string {
  if (phase === "ready") return "setup.serviceReady";
  if (phase === "failed") return "setup.serviceFailed";
  if (phase === "stopped" || phase === "disabled") return "setup.serviceStopped";
  return "setup.serviceWorking";
}

export function ProxySetupSlot({ context: pluginContext }: { context: ManagedPluginContext }): ReactElement {
  const { t } = useTranslation();
  const {
    status, models, accountsByProvider, busy, flow, error, setError,
    refreshing, syncing, syncedModelCount, startingOAuth,
    removalCandidate, setRemovalCandidate, removingAccount,
    accounts, refresh, startOAuth, cancelOAuth, dismissFlow, removeAccount
  } = useProxyConsole(pluginContext);

  return (
    <section className="space-y-5" aria-live="polite">
      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/70 to-muted/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ServiceIcon />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t("setup.title")}</p>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{t("setup.subtitle")}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.phase === "ready" ? "bg-emerald-500/15 text-emerald-400" : status.phase === "failed" ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
            {busy ? <Spin /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
            {t(statusLabelKey(status.phase))}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          <span className="rounded-md bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">{t("setup.runtimeVersion", { version: status.version })}</span>
          <span className="rounded-md bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">{t("setup.routesDiscovered", { count: models.length })}</span>
          {syncedModelCount !== null ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-400" role="status">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {t("setup.syncSuccess", { count: syncedModelCount })}
            </span>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            {status.phase === "failed" || status.phase === "stopped" ? (
              <Button className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" onClick={() => void ensureServiceStarted(pluginContext).catch((reason: unknown) => setError(t("setup.startFailed", { details: toDisplayErrorMessage(reason) })))}>{t("setup.start")}</Button>
            ) : null}
            {status.phase === "ready" ? (
              <>
                <Button className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" onClick={() => void refresh(true)} disabled={refreshing}>
                  {syncing ? <Spin /> : <ActionIcon name="sync" />}
                  {t(syncing ? "setup.syncingModels" : "setup.syncModels")}
                </Button>
                <Button onClick={() => void pluginContext.services.restart(SERVICE_ID).catch((reason: unknown) => setError(t("setup.restartFailed", { details: toDisplayErrorMessage(reason) })))}><ActionIcon name="restart" />{t("setup.restart")}</Button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{error}</p> : null}

      <section aria-labelledby="cli-proxy-oauth-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p id="cli-proxy-oauth-title" className="text-sm font-semibold text-foreground">{t("setup.oauthTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("setup.oauthDescription")}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {OAUTH_PROVIDERS.map((provider) => {
            const providerName = t(`provider.${provider.id}`);
            const providerAccounts = accountsByProvider.get(provider.id) ?? [];
            const activeCount = providerAccounts.filter((account) => account.active).length;
            const unavailableCount = providerAccounts.length - activeCount;
            const actionKey = providerAccounts.length > 0 ? "setup.addOrReplace" : "setup.connect";
            return (
              <div key={provider.id} className="group flex min-h-28 flex-col justify-between rounded-xl border border-border/50 bg-card/25 p-3 transition-colors hover:border-border hover:bg-card/50">
                <div className="flex items-center gap-3">
                  <ProviderIcon provider={provider.id} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{providerName}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{provider.deviceFlow ? t("setup.deviceFlow") : t("setup.browserFlow")}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className={`inline-flex min-w-0 items-center gap-1.5 truncate text-[11px] ${activeCount > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${activeCount > 0 ? "bg-emerald-400" : unavailableCount > 0 ? "bg-amber-400" : "bg-muted-foreground/40"}`} aria-hidden="true" />
                    {providerAccounts.length > 0 ? t("setup.accountStatus", { active: activeCount, unavailable: unavailableCount }) : t("setup.notConnected")}
                  </span>
                  <Button className="shrink-0" aria-label={`${t(actionKey)} ${providerName}`} disabled={status.phase !== "ready" || startingOAuth || flow?.phase === "waiting" || removingAccount !== null} onClick={() => void startOAuth(provider)}>
                    {t(actionKey)}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

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

      {accounts.length > 0 ? (
        <section aria-labelledby="cli-proxy-accounts-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="cli-proxy-accounts-title" className="text-sm font-semibold text-foreground">{t("setup.accountsTitle")}</p>
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">{t("setup.accountsCount", { count: accounts.length })}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("setup.replaceHint")}</p>
          <ul className="mt-3 divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50 bg-card/20">
            {accounts.map((account) => {
              const confirming = removalCandidate === account.key;
              const removing = removingAccount === account.key;
              const accountProvider = providerForAccount(account);
              return (
                <li key={account.key} className="px-3 py-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      {accountProvider ? <ProviderIcon provider={accountProvider} compact /> : (
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold uppercase text-muted-foreground" aria-hidden="true">{account.provider.slice(0, 1)}</span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{account.displayName}</p>
                        <p className="mt-0.5">{accountProvider ? t(`provider.${accountProvider}`) : account.provider}</p>
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] ${account.active ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{t(account.active ? "setup.accountActive" : "setup.accountUnavailable")}
                      </span>
                      {account.removable ? (
                        confirming ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button className="border-destructive/40 text-destructive hover:bg-destructive/10" aria-label={`${t("setup.confirmRemove")} ${account.displayName}`} disabled={removing} onClick={() => void removeAccount(account)}>
                              {removing ? <Spin /> : <ActionIcon name="remove" />}{t("setup.confirmRemove")}
                            </Button>
                            <Button className="border-transparent bg-transparent" disabled={removing} onClick={() => setRemovalCandidate(null)}>{t("setup.cancel")}</Button>
                          </div>
                        ) : (
                          <Button className="border-transparent bg-transparent text-muted-foreground hover:text-foreground" aria-label={`${t("setup.removeAccount")} ${account.displayName}`} disabled={removingAccount !== null || flow?.phase === "waiting"} onClick={() => setRemovalCandidate(account.key)}>
                            <ActionIcon name="remove" />{t("setup.removeAccount")}
                          </Button>
                        )
                      ) : <span>{t("setup.runtimeManagedAccount")}</span>}
                    </div>
                  </div>
                  {confirming ? <p className="mt-2 text-destructive">{t("setup.removeAccountConfirm", { account: account.displayName })}</p> : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"><span className="mt-px" aria-hidden="true">ⓘ</span>{t("setup.removeLocalOnly")}</p>
        </section>
      ) : null}

      {status.recentOutput ? (
        <details className="rounded-lg border border-border/40 bg-card/15 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">{t("setup.diagnostics")}</summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-2 font-mono text-[11px]">{status.recentOutput}</pre>
        </details>
      ) : null}
    </section>
  );
}
