import { definePlugin, useTranslation, type PluginCliProviderStatus, type PluginCommandSpawnHandle, type PluginContext } from "@vetta-org/plugin-sdk";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@vetta/ui";
import { useCallback, useEffect, useRef, useState } from "react";

const PROVIDER_ID = "lark-cli";
const URL_PATTERN = /https:\/\/[^\s\u001b]+/u;

type FlowKind = "app" | "auth";
type AppConfig = { appId: string };

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
  return (
    <section className="rounded-xl border border-border/60 bg-card/70 p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("setup.title")}</p>
          {providerBusy ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(statusTextKey(provider.phase))}</p>
          ) : provider.phase === "failed" ? (
            <>
              <p className="mt-1 text-xs text-destructive">{t("setup.failed")}</p>
              {provider.message ? <p className="mt-1 break-words text-xs text-muted-foreground">{provider.message}</p> : null}
            </>
          ) : appConfig ? (
            <>
              <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{t("setup.appReady")}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{t("setup.appId", { appId: appConfig.appId })}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{t("setup.readyTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("setup.readyDescription")}</p>
            </>
          )}
        </div>
        <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${provider.phase === "failed" ? "bg-destructive" : provider.phase === "ready" ? "bg-emerald-500" : "animate-pulse bg-primary"}`} aria-hidden="true" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {provider.phase === "failed" ? (
          <Button size="sm" onClick={() => void pluginContext.cliProviders.retry(PROVIDER_ID)}>{t("setup.retry")}</Button>
        ) : null}
        {provider.phase === "ready" && configChecked && !appConfig ? (
          <Button size="sm" onClick={() => void startFlow("app")}>{t("setup.configure")}</Button>
        ) : null}
        {provider.phase === "ready" && appConfig && !authReady ? (
          <Button size="sm" variant="secondary" onClick={() => void startFlow("auth")}>{t("setup.userAuth")}</Button>
        ) : null}
        {authReady ? <span className="self-center text-xs text-muted-foreground">{t("setup.authReady")}</span> : null}
        {flow && (flowHandle || setupUrl) ? (
          <Button size="sm" variant="ghost" onClick={() => setDialogOpen(true)}>{flow === "app" ? t("setup.configure") : t("setup.userAuth")}</Button>
        ) : null}
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
            <DialogDescription>{qrCode ? t("setup.qrInstruction") : t("setup.qrWaiting")}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-64 items-center justify-center rounded-xl bg-white p-3">
            {qrCode ? <img src={qrCode} className="h-64 w-64" alt={flow === "auth" ? t("setup.qrTitleAuth") : t("setup.qrTitleApp")} /> : <span className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden="true" />}
          </div>
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
