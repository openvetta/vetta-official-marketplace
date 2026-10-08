import { useTranslation } from "@vetta-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { OAUTH_PROVIDERS } from "../../../provider-contract";
import { type ManagedPluginContext } from "../../../runtime-contract";
import { ensureServiceStarted } from "../../../runtime-provisioner";
import { toDisplayErrorMessage } from "../../../error-message";
import { ProviderIcon } from "../../../shared/components/provider-icon";
import { ActionIcon } from "../../../shared/components/action-icon";
import { Button } from "../../../shared/components/button";
import { Spin } from "../../../shared/components/spin";
import { Dialog } from "../../../shared/components/dialog";
import { providerForAccount, useProxyConsole } from "../hooks/use-proxy-console";
import { migrateLegacySelection, readModelSelection, writeModelSelection, type ModelRouteKey, type ModelSelection } from "../../../model-selection";
import { SERVICE_ID, createProxyClient, type ChannelModel, type ProxyAccount } from "../../../proxy-client";
import { buildProviderPools } from "../../../provider-pools";
import { WORKSPACE_VIEW_ID } from "../../../domain/workspace-view-id";
import { statusLabelKey } from "../../../domain/service-labels";
import { HealthOverview } from "./health-overview";
import { ReloadNotice } from "./reload-notice";
import { AccountCard } from "./account-card";
import { ModelDialog } from "./model-dialog";
import { ConnectDialog } from "./connect-dialog";
import { type ModelGroupState } from "../../../domain/model-group-state";
import { ModelPicker } from "./model-picker";

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
    refresh, startOAuth, cancelOAuth, dismissFlow, removeAccount, toggleAccount, resetQuota, refreshCredential
  } = useProxyConsole(pluginContext);

  const client = useMemo(() => createProxyClient(pluginContext), [pluginContext]);
  const [connecting, setConnecting] = useState(false);
  const [modelAccount, setModelAccount] = useState<ProxyAccount | null>(null);
  const [accountModels, setAccountModels] = useState<ChannelModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [groupedModels, setGroupedModels] = useState<ReadonlyMap<string, ModelGroupState>>(new Map());
  const [pickerLoading, setPickerLoading] = useState(true);
  /**
   * Bumped to re-read the models a credential should have.
   *
   * Restarting the gateway, authorizing an account and refreshing a token all
   * leave the credential listed and active while its routes are still being
   * rebuilt, so a read landing in that window sees nothing. Measured against a
   * real restart, the window is a minute or two — long enough that the panel was
   * settling on "no models" and never looking again.
   */
  const [retryTick, setRetryTick] = useState(0);
  const retries = useRef(0);
  const settling = useRef(false);
  const [selected, setSelected] = useState<ReadonlySet<ModelRouteKey>>(new Set());
  const allMode = useRef(true);
  /**
   * Whether the stored selection has been read.
   *
   * A ref, not state: the loader effect re-runs whenever the catalog changes,
   * and a stale `false` in its closure would take the first-load branch again
   * and re-tick every model — quietly undoing what the user had just cleared.
   */
  const selectionLoaded = useRef(false);
  /**
   * Every model id the picker has **ever** offered, not just the current batch.
   *
   * Cumulative on purpose: a credential briefly reports nothing while the
   * gateway rebuilds its routes, and replacing this set with each batch made
   * those ids look brand new when they came back — silently re-ticking models
   * the user had deselected.
   */
  const knownIds = useRef<ReadonlySet<ModelRouteKey>>(new Set());
  /** Latest ids the gateway offered, whether or not the selection has been read. */
  const offered = useRef<ReadonlySet<ModelRouteKey>>(new Set());
  /** Set once the user changes the selection, so a late read cannot overwrite it. */
  const touched = useRef(false);
  /** The stored choice, once read; `null` means "everything". */
  const storedSelection = useRef<ModelSelection>({ mode: "all" });
  const seeded = useRef(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);

  // One read per credential, refreshed whenever the set of credentials changes.
  const accountKeys = accounts.map((account) => account.key).join("|");
  useEffect(() => { retries.current = 0; }, [accountKeys]);
  useEffect(() => {
    let active = true;
    if (accounts.length === 0) {
      setGroupedModels(new Map());
      setPickerLoading(false);
      return () => { active = false; };
    }
    if (retries.current === 0) setPickerLoading(true);
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
      const every = new Set(buildProviderPools(accounts, next).flatMap((pool) => pool.models.map((model) => model.routeKey)));
      setGroupedModels(next);
      setPickerLoading(false);
      // Seeding is the other effect's job. Two loads could otherwise both find
      // the selection "not yet read" and each re-tick everything, undoing a
      // clear the user had just made.
      // Active credentials that answered with nothing are probably mid-rebuild.
      const unsettled = accounts.some((account) => account.active
        && !next.get(account.key)?.error
        && (next.get(account.key)?.models.length ?? 0) === 0);
      const delay = [800, 1600, 3000, 5000, 8000][retries.current];
      settling.current = unsettled && delay !== undefined;
      if (settling.current) {
        retries.current += 1;
        window.setTimeout(() => { if (active) setRetryTick((tick) => tick + 1); }, delay);
      }
      offered.current = every;
      if (seedSelection()) return;
      // "All" follows future routes. A custom selection intentionally does not.
      const fresh = [...every].filter((id) => !knownIds.current.has(id));
      knownIds.current = new Set([...knownIds.current, ...every]);
      const stored = storedSelection.current;
      const legacyFresh = stored.mode === "legacy"
        ? fresh.filter((route) => stored.ids.has(route.slice(route.indexOf("/") + 1)))
        : [];
      if (fresh.length > 0 && (allMode.current || legacyFresh.length > 0)) {
        setSelected((current) => new Set([...current, ...(allMode.current ? fresh : legacyFresh)]));
      }
    });
    return () => { active = false; };
  }, [accountKeys, catalog, client, retryTick]);

  /**
   * Establishes the initial selection, exactly once, and only when both halves
   * are in: the stored choice and the first batch of models.
   *
   * Seeding on whichever arrives first was the bug — reading storage before any
   * model had loaded left "already offered" empty, so the entire first batch
   * then counted as newly discovered and was ticked on, undoing a clear the user
   * had made in between. Returns true when it did the seeding.
   */
  const seedSelection = useCallback((): boolean => {
    if (seeded.current || !selectionLoaded.current || offered.current.size === 0) return false;
    seeded.current = true;
    knownIds.current = offered.current;
    if (!touched.current) {
      const stored = storedSelection.current;
      allMode.current = stored.mode === "all";
      if (stored.mode === "all") setSelected(offered.current);
      else if (stored.mode === "custom") setSelected(new Set([...offered.current].filter((route) => stored.routes.has(route))));
      else setSelected(new Set([...offered.current].filter((route) => stored.ids.has(route.slice(route.indexOf("/") + 1)))));
    }
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    void readModelSelection(pluginContext).then((stored) => {
      if (!active) return;
      storedSelection.current = stored;
      selectionLoaded.current = true;
      seedSelection();
    });
    return () => { active = false; };
  }, [pluginContext, seedSelection]);

  const applySelection = useCallback(async (): Promise<void> => {
    setConfirmApply(false);
    setApplying(true);
    try {
      // Re-read rather than publish the page's routable list: applying a choice
      // must not double as a deletion of models the gateway has not registered.
      const { models: publishable, complete } = await client.loadPublishableModels();
      const desired: ModelSelection = !touched.current && storedSelection.current.mode === "legacy"
        ? storedSelection.current
        : allMode.current
          ? { mode: "all" }
          : { mode: "custom", routes: selected };
      const selection = complete ? migrateLegacySelection(desired, publishable) : desired;
      // Do not overwrite v1 until every credential catalog is conclusive.
      if (selection.mode !== "legacy") await writeModelSelection(pluginContext, selection);
      await client.publishModels(publishable, () => true, selection);
      // The picker is only true once the window re-reads the model settings.
      window.location.reload();
    } catch (reason) {
      setApplying(false);
      // Surfaced on the page, not in the model dialog: apply is a page-level action.
      setError(t("console.applyFailed", { details: toDisplayErrorMessage(reason) }));
    }
  }, [client, pluginContext, selected, setError, t]);

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
              {/* Publishing belongs to Apply now; this only re-reads the gateway. */}
              <Button disabled={refreshing} onClick={() => void refresh(false)}>
                {refreshing ? <Spin /> : <ActionIcon name="sync" />}
                {t("console.refresh")}
              </Button>
              {/* Labelled, not icon-only: its glyph reads as another refresh. */}
              <Button onClick={() => void pluginContext.services.restart(SERVICE_ID)}>
                <ActionIcon name="restart" />{t("console.restartService")}
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
                onRefreshCredential={() => void refreshCredential(account)}
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
            settling={settling.current}
            selected={selected}
            setSelected={(next, nextAllMode) => {
              touched.current = true;
              allMode.current = nextAllMode;
              setSelected(next);
            }}
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
