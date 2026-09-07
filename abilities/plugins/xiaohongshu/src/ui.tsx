import { useTranslation } from "@vetta-org/plugin-sdk";
import { useCallback, useEffect, useState, type ReactElement } from "react";
import type { ManagedPluginContext } from "./runtime-contract";
import { ensureServiceStarted } from "./runtime";
import { renderQrCode } from "./qr";
import {
  beginLogin,
  loginStatus,
  persistLoggedInAccount,
  readAccountState,
  removeAccount,
  switchAccount,
  type XhsAccount,
} from "./xhs";

type UiStatus = "starting" | "notLoggedIn" | "waitingQr" | "waitingScan" | "verifying" | "connected" | "failed";

const BUTTON_CLASS = "cursor-pointer rounded-lg border border-border/70 bg-primary/10 px-3 py-2 text-xs text-foreground transition-colors hover:bg-primary/20 disabled:cursor-wait disabled:opacity-50";
const STATUS_BASE_CLASS = "rounded-full bg-primary/15 px-2 py-1 text-[11px]";
const STATUS_CLASSES: Record<UiStatus, string> = {
  starting: STATUS_BASE_CLASS,
  notLoggedIn: STATUS_BASE_CLASS,
  waitingQr: STATUS_BASE_CLASS,
  waitingScan: STATUS_BASE_CLASS,
  verifying: STATUS_BASE_CLASS,
  connected: `${STATUS_BASE_CLASS} text-emerald-400`,
  failed: `${STATUS_BASE_CLASS} text-destructive`,
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorText(t: (key: string, params?: Record<string, string | number>) => string, key: string, details: string): string {
  const translated = t(key, { details });
  // Older host bridges returned the catalog string without applying params.
  // Resolve the placeholder locally so users never see `{{details}}`.
  return translated.replaceAll("{{details}}", details);
}

export function XhsSetupSlot({ context, compact = false }: { context: ManagedPluginContext; compact?: boolean }): ReactElement {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UiStatus>("starting");
  const [account, setAccount] = useState<XhsAccount | undefined>();
  const [qr, setQr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const state = await readAccountState(context);
      const active = state.accounts.find((item) => item.id === state.activeAccountId);
      const loggedIn = await loginStatus(context);
      setAccount(active ? { ...active, status: loggedIn.loggedIn ? "connected" : "expired" } : undefined);
      setStatus(loggedIn.loggedIn ? "connected" : "notLoggedIn");
    } catch (reason) {
      setStatus("failed");
      setError(messageOf(reason));
    }
  }, [context]);

  useEffect(() => {
    void ensureServiceStarted(context)
      .then(() => context.services.reportReady("xhs", true))
      .then(() => refresh())
      .catch((reason: unknown) => {
        setStatus("failed");
        setError(messageOf(reason));
      });
  }, [context, refresh]);

  const login = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    setQr(undefined);
    try {
      await ensureServiceStarted(context);
      const next = await beginLogin(context);
      setStatus("waitingQr");
      const payload = await context.services.request<{ data?: Record<string, unknown>; url?: string; qrcode?: string }>("xhs", {
        path: "/api/v1/login/qrcode",
        responseType: "json",
        timeoutMs: 30_000,
      });
      const body = payload.body;
      const qrPayload = body.data?.url ?? body.data?.qrcode ?? body.url ?? body.qrcode;
      if (typeof qrPayload !== "string" || !qrPayload) throw new Error("QR response did not contain a URL");
      setQr(await renderQrCode(qrPayload));
      setStatus("waitingScan");
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const current = await loginStatus(context);
        if (current.loggedIn) {
          setStatus("verifying");
          const saved = await persistLoggedInAccount(context, { ...next, name: current.nickname || next.name });
          setAccount(saved);
          setQr(undefined);
          setStatus("connected");
          return;
        }
      }
      throw new Error("QR login timed out");
    } catch (reason) {
      setStatus("failed");
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }, [context]);

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-border/70 bg-card/80 p-4 text-foreground" aria-live="polite">
      {compact ? <div className="flex flex-wrap items-center justify-between gap-2.5"><span className={STATUS_CLASSES[status]}>{t(`setup.${status}`)}</span></div> : (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h3 className="m-0 text-[15px] font-semibold">{t("setup.title")}</h3>
            <p className="m-0 text-xs leading-6 text-muted-foreground">{t("setup.subtitle")}</p>
          </div>
          <span className={STATUS_CLASSES[status]}>{t(`setup.${status}`)}</span>
        </div>
      )}
      {account && status === "connected" ? <p className="m-0 text-xs text-emerald-400">{t("setup.loggedIn", { name: account.name })}</p> : null}
      {qr ? <div className="flex flex-col items-center gap-2 rounded-[10px] bg-white p-3"><img className="size-[280px]" src={qr} alt={t("setup.qrAlt")} /><p className="m-0 text-xs leading-6 text-slate-600">{t("setup.waitingScan")}</p></div> : null}
      {error ? <p className="m-0 text-xs leading-6 text-destructive" role="alert">{errorText(t, "setup.failed", error)}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button className={BUTTON_CLASS} type="button" onClick={() => void login()} disabled={busy}>{busy ? t("setup.waitingQr") : t("setup.login")}</button>
        <button className={BUTTON_CLASS} type="button" onClick={() => void refresh()} disabled={busy}>{t("setup.refresh")}</button>
        {!compact ? <button className={BUTTON_CLASS} type="button" onClick={() => context.ui.openWorkspaceView("accounts")}>{t("setup.openAccounts")}</button> : null}
      </div>
    </section>
  );
}

export function XhsAccountsView({ context }: { context: ManagedPluginContext }): ReactElement {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<XhsAccount[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    const state = await readAccountState(context);
    setAccounts(state.accounts);
    setActiveId(state.activeAccountId);
  }, [context]);

  useEffect(() => { void refresh().catch((reason: unknown) => setError(messageOf(reason))); }, [refresh]);

  const activate = useCallback(async (id: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await switchAccount(context, id);
      await refresh();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }, [context, refresh]);

  const remove = useCallback(async (account: XhsAccount) => {
    if (!window.confirm(t("accounts.removeConfirm", { name: account.name }))) return;
    setBusy(true);
    try {
      await removeAccount(context, account.id);
      await refresh();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }, [context, refresh, t]);

  return (
    <main className="flex flex-col gap-3 rounded-[14px] border border-border/70 bg-card/80 p-4 text-foreground" aria-live="polite">
      <h1 className="m-0 text-[15px] font-semibold">{t("accounts.title")}</h1>
      <p className="m-0 text-xs leading-6 text-muted-foreground">{t("accounts.subtitle")}</p>
      <XhsSetupSlot context={context} compact />
      {error ? <p className="m-0 text-xs leading-6 text-destructive" role="alert">{errorText(t, "accounts.error", error)}</p> : null}
      {accounts.length === 0 ? <p className="rounded-[10px] border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("accounts.empty")}</p> : accounts.map((account) => (
        <article className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/50 p-3" key={account.id}>
          <div className="flex items-center gap-2"><strong>{account.name}</strong>{activeId === account.id ? <span className="rounded-full bg-primary/15 px-2 py-1 text-[11px]">{t("accounts.active")}</span> : null}</div>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {activeId !== account.id ? <button className={BUTTON_CLASS} type="button" onClick={() => void activate(account.id)} disabled={busy}>{t("accounts.switch")}</button> : null}
            <button className={BUTTON_CLASS} type="button" onClick={() => void remove(account)} disabled={busy}>{t("accounts.remove")}</button>
          </div>
        </article>
      ))}
    </main>
  );
}
