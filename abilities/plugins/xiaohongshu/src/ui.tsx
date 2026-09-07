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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function XhsSetupSlot({ context }: { context: ManagedPluginContext }): ReactElement {
  const { t } = useTranslation();
  const [status, setStatus] = useState("starting");
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
    <section className="xhs-card" aria-live="polite">
      <div className="xhs-card-heading">
        <div>
          <h3>{t("setup.title")}</h3>
          <p>{t("setup.subtitle")}</p>
        </div>
        <span className={`xhs-status xhs-status-${status}`}>{t(`setup.${status}`)}</span>
      </div>
      {account && status === "connected" ? <p className="xhs-success">{t("setup.loggedIn", { name: account.name })}</p> : null}
      {qr ? <div className="xhs-qr"><img src={qr} alt={t("setup.qrAlt")} /><p>{t("setup.waitingScan")}</p></div> : null}
      {error ? <p className="xhs-error" role="alert">{t("setup.failed", { details: error })}</p> : null}
      <div className="xhs-actions">
        <button type="button" onClick={() => void login()} disabled={busy}>{busy ? t("setup.waitingQr") : t("setup.login")}</button>
        <button type="button" onClick={() => void refresh()} disabled={busy}>{t("setup.refresh")}</button>
        <button type="button" onClick={() => context.ui.openWorkspaceView("accounts")}>{t("setup.openAccounts")}</button>
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
    <main className="xhs-workspace" aria-live="polite">
      <h1>{t("accounts.title")}</h1>
      <p>{t("accounts.subtitle")}</p>
      <XhsSetupSlot context={context} />
      {error ? <p className="xhs-error" role="alert">{t("accounts.error", { details: error })}</p> : null}
      {accounts.length === 0 ? <p className="xhs-empty">{t("accounts.empty")}</p> : accounts.map((account) => (
        <article className="xhs-account" key={account.id}>
          <div><strong>{account.name}</strong>{activeId === account.id ? <span className="xhs-active">{t("accounts.active")}</span> : null}</div>
          <div className="xhs-actions">
            {activeId !== account.id ? <button type="button" onClick={() => void activate(account.id)} disabled={busy}>{t("accounts.switch")}</button> : null}
            <button type="button" onClick={() => void remove(account)} disabled={busy}>{t("accounts.remove")}</button>
          </div>
        </article>
      ))}
    </main>
  );
}
