import { useTranslation } from "@vetta-org/plugin-sdk";
import type { ReactElement } from "react";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";
import { ensureServiceStarted } from "./runtime-provisioner";
import { toDisplayErrorMessage } from "./error-message";
import { ActionIcon, Button, ServiceIcon, Spin } from "./ui-kit";
import { useProxyConsole } from "./use-proxy-console";
import { WORKSPACE_VIEW_ID } from "./workspace-view";
import { SERVICE_ID } from "./proxy-client";

function statusLabelKey(phase: ServiceStatus["phase"]): string {
  if (phase === "ready") return "setup.serviceReady";
  if (phase === "failed") return "setup.serviceFailed";
  if (phase === "stopped" || phase === "disabled") return "setup.serviceStopped";
  return "setup.serviceWorking";
}

/**
 * The ability page's slot: the state of the managed runtime, and the way into
 * the console.
 *
 * Account authorization used to live here as well, which meant two surfaces
 * could each start an OAuth flow against the same gateway and neither could show
 * what the other had just done. Credentials now belong to the CPA setup page
 * alone; this slot answers the one question the ability page is actually for —
 * is the service installed and running.
 */
export function ProxySetupSlot({ context: pluginContext }: { context: ManagedPluginContext }): ReactElement {
  const { t } = useTranslation();
  const { status, models, busy, error, setError, refreshing, syncing, syncedModelCount, refresh } =
    useProxyConsole(pluginContext);

  return (
    <section className="space-y-4" aria-live="polite">
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
          <span className="rounded-md bg-background/50 px-2 py-1 text-[11px] tabular-nums text-muted-foreground">{t("setup.runtimeVersion", { version: status.version })}</span>
          <span className="rounded-md bg-background/50 px-2 py-1 text-[11px] tabular-nums text-muted-foreground">{t("setup.routesDiscovered", { count: models.length })}</span>
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/25 p-3.5">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">{t("setup.consoleHandoff")}</p>
        <Button
          className="shrink-0 border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          onClick={() => pluginContext.ui.openWorkspaceView(WORKSPACE_VIEW_ID)}
        >
          <ActionIcon name="open" />{t("console.openConsole")}
        </Button>
      </div>

      {status.recentOutput ? (
        <details className="rounded-lg border border-border/40 bg-card/15 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">{t("setup.diagnostics")}</summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-2 font-mono text-[11px]">{status.recentOutput}</pre>
        </details>
      ) : null}
    </section>
  );
}
