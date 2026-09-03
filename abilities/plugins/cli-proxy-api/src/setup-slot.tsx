import { useTranslation } from "@vetta-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactElement } from "react";
import { OAUTH_PROVIDERS, type OAuthProviderDefinition, type OAuthProviderId } from "./provider-contract";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";
import { ensureServiceStarted } from "./runtime-provisioner";
import { toDisplayErrorMessage } from "./error-message";

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
      className={`rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Spin(): ReactElement {
  return <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]" aria-hidden="true" />;
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
    <section className="rounded-xl border border-border/60 bg-card/40 p-4" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{t("setup.title")}</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{t("setup.subtitle")}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs ${status.phase === "ready" ? "bg-emerald-500/15 text-emerald-400" : status.phase === "failed" ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
          {busy ? <Spin /> : null}
          {t(statusLabelKey(status.phase))}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {status.phase === "failed" || status.phase === "stopped" ? (
          <Button onClick={() => void ensureServiceStarted(pluginContext).catch((reason: unknown) => setError(t("setup.startFailed", { details: toDisplayErrorMessage(reason) })))}>{t("setup.start")}</Button>
        ) : null}
        {status.phase === "ready" ? (
          <>
            <Button onClick={() => void refresh(true)} disabled={refreshing}>{t("setup.syncModels")}</Button>
            <Button onClick={() => void pluginContext.services.restart(SERVICE_ID).catch((reason: unknown) => setError(t("setup.restartFailed", { details: toDisplayErrorMessage(reason) })))}>{t("setup.restart")}</Button>
          </>
        ) : null}
        <span className="self-center text-xs text-muted-foreground">{t("setup.runtime", { version: status.version, count: models.length })}</span>
      </div>

      {error ? <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{error}</p> : null}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("setup.oauthTitle")}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {OAUTH_PROVIDERS.map((provider) => {
            const providerName = t(`provider.${provider.id}`);
            const providerAccounts = accountsByProvider.get(provider.id) ?? [];
            const activeCount = providerAccounts.filter((account) => account.active).length;
            const unavailableCount = providerAccounts.length - activeCount;
            const actionKey = providerAccounts.length > 0 ? "setup.addOrReplace" : "setup.connect";
            return (
              <div key={provider.id} className="rounded-lg border border-border/50 bg-background/25 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{providerName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {provider.deviceFlow ? t("setup.deviceFlow") : t("setup.browserFlow")}
                      {providerAccounts.length > 0 ? ` · ${t("setup.accountStatus", { active: activeCount, unavailable: unavailableCount })}` : ""}
                    </p>
                  </div>
                  <Button aria-label={`${t(actionKey)} ${providerName}`} disabled={status.phase !== "ready" || startingOAuth || flow?.phase === "waiting" || removingAccount !== null} onClick={() => void startOAuth(provider)}>
                    {t(actionKey)}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {flow ? (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium text-foreground">{t(`provider.${flow.provider}`)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {flow.phase === "waiting" ? t("setup.oauthWaiting") : flow.phase === "success" ? t("setup.oauthSuccess") : flow.error}
          </p>
          {flow.userCode ? <p className="mt-2 font-mono text-lg font-semibold tracking-widest text-foreground">{flow.userCode}</p> : null}
          <div className="mt-3 flex gap-2">
            {flow.phase === "waiting" ? (
              <>
                <Button onClick={() => void pluginContext.ui.openExternal(flow.url)}>{t("setup.openAuth")}</Button>
                <Button className="border-transparent bg-transparent" onClick={() => void cancelOAuth()}>{t("setup.cancel")}</Button>
              </>
            ) : (
              <Button className="border-transparent bg-transparent" onClick={() => { flowRef.current = null; setFlow(null); }}>{t("setup.close")}</Button>
            )}
          </div>
        </div>
      ) : null}

      {accounts.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border/50 bg-background/20 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{t("setup.accountsTitle")}</p>
          <p className="mt-1 leading-relaxed">{t("setup.replaceHint")}</p>
          <ul className="mt-3 space-y-2">
            {accounts.map((account) => {
              const confirming = removalCandidate === account.key;
              const removing = removingAccount === account.key;
              return (
                <li key={account.key} className="rounded-md border border-border/40 bg-background/30 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{account.displayName}</p>
                      <p className="mt-0.5">{account.provider} · {t(account.active ? "setup.accountActive" : "setup.accountUnavailable")}</p>
                    </div>
                    {account.removable ? (
                      confirming ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            aria-label={`${t("setup.confirmRemove")} ${account.displayName}`}
                            disabled={removing}
                            onClick={() => void removeAccount(account)}
                          >
                            {removing ? <Spin /> : null}{t("setup.confirmRemove")}
                          </Button>
                          <Button className="border-transparent bg-transparent" disabled={removing} onClick={() => setRemovalCandidate(null)}>{t("setup.cancel")}</Button>
                        </div>
                      ) : (
                        <Button
                          aria-label={`${t("setup.removeAccount")} ${account.displayName}`}
                          disabled={removingAccount !== null || flow?.phase === "waiting"}
                          onClick={() => setRemovalCandidate(account.key)}
                        >
                          {t("setup.removeAccount")}
                        </Button>
                      )
                    ) : <span>{t("setup.runtimeManagedAccount")}</span>}
                  </div>
                  {confirming ? <p className="mt-2 text-destructive">{t("setup.removeAccountConfirm", { account: account.displayName })}</p> : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 leading-relaxed">{t("setup.removeLocalOnly")}</p>
        </div>
      ) : null}

      {status.recentOutput ? (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">{t("setup.diagnostics")}</summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-2 font-mono text-[11px]">{status.recentOutput}</pre>
        </details>
      ) : null}
    </section>
  );
}
