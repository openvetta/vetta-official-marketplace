import { useTranslation } from "@vetta-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactElement } from "react";
import { OAUTH_PROVIDERS, type OAuthProviderDefinition, type OAuthProviderId } from "./provider-contract";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";
import { ensureServiceStarted } from "./runtime-provisioner";
import { toDisplayErrorMessage } from "./error-message";
import { ProviderIcon } from "./provider-icon";

import { API_CREDENTIAL, MANAGER_CREDENTIAL, SERVICE_ID, createProxyClient, record, textField, safeExternalUrl, type ProxyAccount, type ProxyModel } from "./proxy-client";

type OAuthFlow = {
  provider: OAuthProviderId;
  state: string;
  url: string;
  userCode?: string;
  phase: "waiting" | "success" | "error";
  error?: string;
};

function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Spin(): ReactElement {
  return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]" aria-hidden="true" />;
}

function statusLabelKey(phase: ServiceStatus["phase"]): string {
  if (phase === "ready") return "setup.serviceReady";
  if (phase === "failed") return "setup.serviceFailed";
  if (phase === "stopped" || phase === "disabled") return "setup.serviceStopped";
  return "setup.serviceWorking";
}

function accountMatchesProvider(account: ProxyAccount, provider: OAuthProviderId): boolean {
  const value = account.provider.trim().toLowerCase();
  if (provider === "claude") return value === "claude" || value === "anthropic";
  if (provider === "gemini-cli") return value === "gemini-cli" || value === "gemini";
  return value === provider;
}

function providerForAccount(account: ProxyAccount): OAuthProviderId | undefined {
  return OAUTH_PROVIDERS.find((provider) => accountMatchesProvider(account, provider.id))?.id;
}

function ServiceIcon(): ReactElement {
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20" aria-hidden="true">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8.5h14M5 15.5h14" /><circle cx="8" cy="8.5" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="15.5" r="1" fill="currentColor" stroke="none" /><rect x="3" y="4" width="18" height="16" rx="4" />
      </svg>
    </span>
  );
}

function ActionIcon({ name }: { name: "sync" | "restart" | "open" | "remove" }): ReactElement {
  const path = name === "sync"
    ? <><path d="M20 7h-5V2" /><path d="M20 7a8 8 0 1 0 1 7" /></>
    : name === "restart"
      ? <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>
      : name === "open"
        ? <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>
        : <><path d="M4 7h16M9 7V4h6v3M8 11v6M12 11v6M16 11v6M6 7l1 14h10l1-14" /></>;
  return <svg className="h-3.5 w-3.5" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}

export function ProxySetupSlot({ context: pluginContext }: { context: ManagedPluginContext }): ReactElement {
  const client = useMemo(() => createProxyClient(pluginContext), [pluginContext]);
  const { serviceRequest, readModels, readAccounts, publishModels } = client;
  const { t } = useTranslation();
  const [status, setStatus] = useState<ServiceStatus>({
    serviceId: SERVICE_ID,
    phase: "stopped",
    version: "…",
    installed: false,
    recentOutput: ""
  });
  const [models, setModels] = useState<ProxyModel[]>([]);
  const [accounts, setAccounts] = useState<ProxyAccount[]>([]);
  const [flow, setFlow] = useState<OAuthFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [startingOAuth, setStartingOAuth] = useState(false);
  const [removalCandidate, setRemovalCandidate] = useState<string | null>(null);
  const [removingAccount, setRemovingAccount] = useState<string | null>(null);
  const startingRef = useRef(false);
  const removingAccountRef = useRef(false);
  const oauthGeneration = useRef(0);
  const flowRef = useRef<OAuthFlow | null>(null);

  const refresh = useCallback(async (publish: boolean): Promise<void> => {
    setRefreshing(true);
    setError(null);
    try {
      const [modelPayload, accountPayload] = await Promise.all([
        serviceRequest<unknown>("/v1/models", { credentialId: API_CREDENTIAL }),
        serviceRequest<unknown>("/v0/management/auth-files", { credentialId: MANAGER_CREDENTIAL })
      ]);
      const nextModels = readModels(modelPayload);
      setModels(nextModels);
      setAccounts(readAccounts(accountPayload));
      if (publish) await publishModels(nextModels);
    } catch (reason) {
      setError(toDisplayErrorMessage(reason));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const startOAuth = useCallback(async (provider: OAuthProviderDefinition): Promise<void> => {
    if (startingRef.current || flowRef.current?.phase === "waiting") return;
    startingRef.current = true;
    setStartingOAuth(true);
    setRemovalCandidate(null);
    const generation = ++oauthGeneration.current;
    setError(null);
    try {
      const payload = record(await serviceRequest<unknown>(provider.authPath, { credentialId: MANAGER_CREDENTIAL }));
      const state = textField(payload, "state");
      const rawUrl = textField(payload, "url", "verification_uri_complete", "verification_uri");
      if (!state || !rawUrl || textField(payload, "status") !== "ok") throw new Error("Invalid OAuth start response");
      if (generation !== oauthGeneration.current) {
        await serviceRequest(`/v0/management/oauth-session?state=${encodeURIComponent(state)}`, {
          credentialId: MANAGER_CREDENTIAL, method: "DELETE"
        });
        return;
      }
      const next: OAuthFlow = {
        provider: provider.id,
        state,
        url: safeExternalUrl(rawUrl),
        userCode: textField(payload, "user_code"),
        phase: "waiting"
      };
      flowRef.current = next;
      setFlow(next);
      await pluginContext.ui.openExternal(next.url);
    } catch (reason) {
      if (generation === oauthGeneration.current) setError(toDisplayErrorMessage(reason));
    } finally {
      startingRef.current = false;
      if (generation === oauthGeneration.current) setStartingOAuth(false);
    }
  }, []);

  const cancelOAuth = useCallback(async (): Promise<void> => {
    const current = flowRef.current;
    if (!current) return;
    oauthGeneration.current += 1;
    flowRef.current = null;
    setFlow(null);
    try {
      await serviceRequest(`/v0/management/oauth-session?state=${encodeURIComponent(current.state)}`, {
        credentialId: MANAGER_CREDENTIAL, method: "DELETE"
      });
    } catch (reason) {
      setError(toDisplayErrorMessage(reason));
    }
  }, []);

  const removeAccount = useCallback(async (account: ProxyAccount): Promise<void> => {
    if (!account.removable || !account.deleteName || removingAccountRef.current) return;
    removingAccountRef.current = true;
    setRemovingAccount(account.key);
    setError(null);
    try {
      await serviceRequest(`/v0/management/auth-files?name=${encodeURIComponent(account.deleteName)}`, {
        credentialId: MANAGER_CREDENTIAL,
        method: "DELETE"
      });
      setRemovalCandidate(null);
      await refresh(true);
    } catch (reason) {
      setError(t("setup.removeFailed", { details: toDisplayErrorMessage(reason) }));
    } finally {
      removingAccountRef.current = false;
      setRemovingAccount(null);
    }
  }, [refresh, serviceRequest, t]);

  useEffect(() => {
    let active = true;
    let previousPhase: ServiceStatus["phase"] | undefined;
    void pluginContext.services.getStatus(SERVICE_ID).then((next) => {
      if (!active) return;
      setStatus(next);
      previousPhase = next.phase;
      if (next.phase === "ready") void refresh(false);
    }).catch((reason: unknown) => { if (active) setError(toDisplayErrorMessage(reason)); });
    const subscription = pluginContext.services.onStatusChange((next) => {
      if (!active || next.serviceId !== SERVICE_ID) return;
      setStatus(next);
      if (next.phase === "ready" && previousPhase !== "ready") void refresh(false);
      previousPhase = next.phase;
    });
    return () => {
      active = false;
      oauthGeneration.current += 1;
      subscription.dispose();
      const current = flowRef.current;
      if (current?.phase === "waiting") {
        void serviceRequest(`/v0/management/oauth-session?state=${encodeURIComponent(current.state)}`, {
          credentialId: MANAGER_CREDENTIAL,
          method: "DELETE"
        }).catch(() => undefined);
      }
    };
  }, [refresh]);

  useEffect(() => {
    if (flow?.phase !== "waiting") return;
    let inFlight = false;
    const timer = window.setInterval(() => {
      const current = flowRef.current;
      if (!current || current.phase !== "waiting" || inFlight) return;
      inFlight = true;
      void serviceRequest<unknown>(`/v0/management/get-auth-status?state=${encodeURIComponent(current.state)}`, {
        credentialId: MANAGER_CREDENTIAL
      }).then((payload) => {
        if (flowRef.current !== current) return;
        const value = record(payload);
        const nextStatus = textField(value, "status");
        if (nextStatus === "wait") return;
        if (nextStatus === "ok") {
          const next = { ...current, phase: "success" as const };
          flowRef.current = next;
          setFlow(next);
          window.clearInterval(timer);
          void refresh(true);
          return;
        }
        const next = { ...current, phase: "error" as const, error: textField(value, "error") ?? t("setup.oauthFailed") };
        flowRef.current = next;
        setFlow(next);
        window.clearInterval(timer);
      }).catch((reason: unknown) => {
        if (flowRef.current !== current) return;
        const next = { ...current, phase: "error" as const, error: toDisplayErrorMessage(reason) };
        flowRef.current = next;
        setFlow(next);
        window.clearInterval(timer);
      }).finally(() => { inFlight = false; });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [flow?.phase, flow?.state, refresh, t]);

  const accountsByProvider = useMemo(() => new Map(
    OAUTH_PROVIDERS.map((provider) => [provider.id, accounts.filter((account) => accountMatchesProvider(account, provider.id))])
  ), [accounts]);
  const busy = status.phase === "installing" || status.phase === "starting" || status.phase === "stopping";

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
          <div className="ml-auto flex flex-wrap gap-2">
            {status.phase === "failed" || status.phase === "stopped" ? (
              <Button className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" onClick={() => void ensureServiceStarted(pluginContext).catch((reason: unknown) => setError(t("setup.startFailed", { details: toDisplayErrorMessage(reason) })))}>{t("setup.start")}</Button>
            ) : null}
            {status.phase === "ready" ? (
              <>
                <Button className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" onClick={() => void refresh(true)} disabled={refreshing}><ActionIcon name="sync" />{t("setup.syncModels")}</Button>
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
                  <Button className="border-transparent bg-transparent" onClick={() => { flowRef.current = null; setFlow(null); }}>{t("setup.close")}</Button>
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
