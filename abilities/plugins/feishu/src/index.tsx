import { definePlugin, useTranslation, type PluginCliProviderStatus, type PluginCommandSpawnHandle, type PluginContext } from "@vetta-org/plugin-sdk";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spin
} from "@vetta/ui";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const PROVIDER_ID = "lark-cli";
const URL_PATTERN = /https:\/\/[^\s\u001b]+/u;

type FlowKind = "app" | "auth";
type AppConfig = { appId: string };
type StepState = "idle" | "active" | "complete" | "error";

let pluginContext: PluginContext;

function readAppConfig(output: string): AppConfig | null {
  const start = output.indexOf("{");
  if (start < 0) return null;
  try {
    const parsed = JSON.parse(output.slice(start)) as { appId?: unknown };
    return typeof parsed.appId === "string" && parsed.appId.trim() ? { appId: parsed.appId } : null;
  } catch {
    return null;
  }
}

function statusTextKey(phase: PluginCliProviderStatus["phase"]): string {
  if (phase === "installing") return "setup.installing";
  if (phase === "verifying") return "setup.verifying";
  return "setup.checking";
}

function SetupStep({
  index,
  title,
  description,
  state,
  action
}: {
  index: number;
  title: string;
  description: string;
  state: StepState;
  action?: ReactNode;
}): JSX.Element {
  const stateClass =
    state === "complete"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : state === "active"
        ? "border-primary/40 bg-primary/10"
        : state === "error"
          ? "border-destructive/40 bg-destructive/10"
          : "border-border/50 bg-background/20";
  const markerClass =
    state === "complete"
      ? "bg-emerald-500/15 text-emerald-400"
      : state === "active"
        ? "bg-primary/15 text-primary"
        : state === "error"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";

  return (
    <li className={`rounded-lg border px-3 py-2.5 transition-colors ${stateClass}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${markerClass}`} aria-hidden="true">
          {state === "complete" ? "✓" : index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {action}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </li>
  );
}

function FeishuSetupSlot(): JSX.Element {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<PluginCliProviderStatus>({
    providerId: PROVIDER_ID,
    phase: "checking",
    recentOutput: ""
  });
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [configChecked, setConfigChecked] = useState(false);
  const [flow, setFlow] = useState<FlowKind | null>(null);
  const [flowHandle, setFlowHandle] = useState<PluginCommandSpawnHandle | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const autoStarted = useRef(false);
  const flowHandleRef = useRef<PluginCommandSpawnHandle | null>(null);

  const checkConfig = useCallback(async (): Promise<AppConfig | null> => {
    const result = await pluginContext.cliProviders.run(PROVIDER_ID, ["config", "show"], { timeoutMs: 15000 });
    const config = result.exitCode === 0 ? readAppConfig(result.stdout) : null;
    setAppConfig(config);
    setConfigChecked(true);
    return config;
  }, []);

  const startFlow = useCallback(async (kind: FlowKind): Promise<void> => {
    await flowHandleRef.current?.stop();
    flowHandleRef.current = null;
    setFlow(kind);
    setFlowError(null);
    setSetupUrl(null);
    setQrCode(null);
    setDialogOpen(true);
    const args = kind === "app" ? ["config", "init", "--new"] : ["auth", "login", "--recommend"];
    try {
      const handle = await pluginContext.cliProviders.spawn(PROVIDER_ID, args);
      flowHandleRef.current = handle;
      setFlowHandle(handle);
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void pluginContext.cliProviders.getStatus(PROVIDER_ID).then(setProvider);
    return pluginContext.cliProviders.onStatusChanged((next) => {
      if (next.providerId === PROVIDER_ID) setProvider(next);
    }).dispose;
  }, []);

  useEffect(() => () => {
    void flowHandleRef.current?.stop();
    flowHandleRef.current = null;
  }, []);

  useEffect(() => {
    if (provider.phase !== "ready" || configChecked) return;
    void checkConfig().then((config) => {
      if (!config && !autoStarted.current) {
        autoStarted.current = true;
        void startFlow("app");
      }
    }).catch((error: unknown) => {
      setConfigChecked(true);
      setFlowError(error instanceof Error ? error.message : String(error));
    });
  }, [checkConfig, configChecked, provider.phase, startFlow]);

  useEffect(() => {
    if (!flowHandle) return;
    let active = true;
    const poll = window.setInterval(() => {
      void flowHandle.status().then(async (status) => {
        if (!active) return;
        const url = status.recentOutput.match(URL_PATTERN)?.[0];
        if (url && url !== setupUrl) {
          setSetupUrl(url);
          setQrCode(await pluginContext.ui.createQrCode(url));
        }
        if (status.running) return;
        window.clearInterval(poll);
        if (flowHandleRef.current === flowHandle) flowHandleRef.current = null;
        setFlowHandle(null);
        if (status.exit?.exitCode !== 0) {
          setFlowError(t("setup.flowFailed"));
          return;
        }
        if (flow === "app") {
          const config = await checkConfig();
          if (config) setDialogOpen(false);
          else setFlowError(t("setup.flowFailed"));
        } else {
          setAuthReady(true);
          setDialogOpen(false);
        }
      }).catch((error: unknown) => {
        if (active) setFlowError(error instanceof Error ? error.message : String(error));
      });
    }, 400);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [checkConfig, flow, flowHandle, setupUrl, t]);

  const providerBusy = provider.phase === "checking" || provider.phase === "installing" || provider.phase === "verifying";
  const cliStep: StepState = provider.phase === "failed" ? "error" : providerBusy ? "active" : provider.phase === "ready" ? "complete" : "idle";
  const appStep: StepState =
    appConfig
      ? "complete"
      : flow === "app" && (flowHandle || setupUrl)
        ? "active"
        : flowError && flow === "app"
          ? "error"
          : "idle";
  const statusLabel = provider.phase === "failed" ? t("setup.statusError") : providerBusy ? t("setup.statusWorking") : appConfig ? t("setup.statusConnected") : t("setup.statusActionNeeded");
  return (
    <section className="rounded-xl border border-border/50 bg-card/40 p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("setup.title")}</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{t("setup.subtitle")}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${provider.phase === "failed" ? "bg-destructive/15 text-destructive" : providerBusy ? "bg-primary/10 text-primary" : appConfig ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
          {statusLabel}
        </span>
      </div>

      <ol className="mt-4 space-y-2" aria-label={t("setup.stepsLabel")}>
        <SetupStep
          index={1}
          title={t("setup.stepCliTitle")}
          description={providerBusy ? t(statusTextKey(provider.phase)) : provider.phase === "failed" ? provider.message || t("setup.failed") : t("setup.stepCliDescription")}
          state={cliStep}
          action={
            providerBusy ? <Spin size="sm" className="text-primary" label={t("setup.statusWorking")} /> : provider.phase === "failed" ? <Button size="xs" onClick={() => void pluginContext.cliProviders.retry(PROVIDER_ID)}>{t("setup.retry")}</Button> : null
          }
        />
        <SetupStep
          index={2}
          title={t("setup.stepAppTitle")}
          description={appConfig ? t("setup.appId", { appId: appConfig.appId }) : t("setup.stepAppDescription")}
          state={appStep}
          action={
            provider.phase === "ready" && !appConfig ? <Button size="xs" onClick={() => void startFlow("app")}>{t("setup.configure")}</Button> : flow === "app" && (flowHandle || setupUrl) ? <Button size="xs" variant="outline" onClick={() => setDialogOpen(true)}>{t("setup.continue")}</Button> : null
          }
        />
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {provider.phase === "ready" && appConfig && !authReady ? (
          <Button size="sm" variant="outline" onClick={() => void startFlow("auth")}>{t("setup.userAuth")}</Button>
        ) : null}
        {authReady ? <span className="text-xs text-emerald-400">{t("setup.authReady")}</span> : null}
        {!providerBusy && !appConfig ? <span className="text-xs text-muted-foreground">{t("setup.authOptional")}</span> : null}
      </div>

      {provider.recentOutput ? (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">{t("setup.details")}</summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-2 font-mono text-[11px]">{provider.recentOutput}</pre>
        </details>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-vetta-plugin-root="feishu" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{flow === "auth" ? t("setup.qrTitleAuth") : t("setup.qrTitleApp")}</DialogTitle>
            <DialogDescription>{qrCode ? t("setup.qrInstruction") : flow === "auth" ? t("setup.qrWaitingAuth") : t("setup.qrWaitingApp")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center rounded-xl border border-border/50 bg-white p-4">
            {qrCode ? <img src={qrCode} className="h-56 w-56" alt={flow === "auth" ? t("setup.qrTitleAuth") : t("setup.qrTitleApp")} /> : <Spin size="md" className="text-primary" label={t("setup.statusWorking")} />}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{flow === "auth" ? t("setup.qrNoteAuth") : t("setup.qrNoteApp")}</p>
          {flowError ? <p className="text-sm text-destructive" role="alert">{flowError}</p> : null}
          <DialogFooter>
            {setupUrl ? <Button variant="secondary" onClick={() => void pluginContext.ui.openExternal(setupUrl)}>{t("setup.openLink")}</Button> : null}
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t("setup.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default definePlugin({
  activate(ctx) {
    pluginContext = ctx;
    return ctx.ui.registerAbilityDetailSlot({
      id: "setup",
      abilityId: "feishu",
      component: FeishuSetupSlot
    });
  }
});
