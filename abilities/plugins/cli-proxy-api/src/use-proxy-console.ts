import { useTranslation } from "@vetta-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OAUTH_PROVIDERS, type OAuthProviderDefinition, type OAuthProviderId } from "./provider-contract";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";
import { toDisplayErrorMessage } from "./error-message";
import { MANAGER_CREDENTIAL, SERVICE_ID, createProxyClient, record, textField, safeExternalUrl, type ProxyAccount, type ProxyModel } from "./proxy-client";

export type OAuthFlow = {
  provider: OAuthProviderId;
  state: string;
  url: string;
  userCode?: string;
  phase: "waiting" | "success" | "error";
  error?: string;
};

export function accountMatchesProvider(account: ProxyAccount, provider: OAuthProviderId): boolean {
  const value = account.provider.trim().toLowerCase();
  if (provider === "claude") return value === "claude" || value === "anthropic";
  if (provider === "gemini-cli") return value === "gemini-cli" || value === "gemini";
  return value === provider;
}

export function providerForAccount(account: ProxyAccount): OAuthProviderId | undefined {
  return OAUTH_PROVIDERS.find((provider) => accountMatchesProvider(account, provider.id))?.id;
}

/**
 * Everything both surfaces need from the local gateway: service phase, the
 * discovered models, the connected accounts and the OAuth handshake.
 *
 * The detail slot and the workspace view render very differently but talk to
 * the same runtime in exactly the same way, and the OAuth flow in particular
 * carries generation counters and cancellation that are easy to get subtly
 * wrong twice — so it lives here once.
 */
export function useProxyConsole(pluginContext: ManagedPluginContext) {
  const client = useMemo(() => createProxyClient(pluginContext), [pluginContext]);
  const { serviceRequest, loadModels, readAccounts, publishModels } = client;
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
  const [syncing, setSyncing] = useState(false);
  const [syncedModelCount, setSyncedModelCount] = useState<number | null>(null);
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
    if (publish) {
      setSyncing(true);
      setSyncedModelCount(null);
      console.info("[cli-proxy-api] Model sync started.");
    }
    try {
      const [nextModels, accountPayload] = await Promise.all([
        loadModels(),
        serviceRequest<unknown>("/v0/management/auth-files", { credentialId: MANAGER_CREDENTIAL })
      ]);
      setModels(nextModels);
      setAccounts(readAccounts(accountPayload));
      if (publish) {
        await publishModels(nextModels);
        setSyncedModelCount(nextModels.length);
        console.info(`[cli-proxy-api] Model sync completed: ${nextModels.length} model(s).`);
      }
    } catch (reason) {
      const details = toDisplayErrorMessage(reason);
      if (publish) {
        setError(t("setup.syncFailed", { details }));
        console.error(`[cli-proxy-api] Model sync failed: ${details}`);
      } else {
        setError(details);
      }
    } finally {
      setRefreshing(false);
      if (publish) setSyncing(false);
    }
  }, [loadModels, publishModels, readAccounts, serviceRequest, t]);

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

  const dismissFlow = useCallback((): void => {
    flowRef.current = null;
    setFlow(null);
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

  return {
    client, status, models, accounts, accountsByProvider, busy, flow, error, setError,
    refreshing, syncing, syncedModelCount, startingOAuth,
    removalCandidate, setRemovalCandidate, removingAccount,
    refresh, startOAuth, cancelOAuth, dismissFlow, removeAccount
  };
}
