import { useTranslation } from "@vetta-org/plugin-sdk";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import type { ManagedPluginContext } from "./runtime-contract";
import { ensureServiceStarted } from "./runtime";
import { renderQrPayload } from "./qr";
import {
  accountDisplayName,
  accountInitial,
  beginLogin,
  loginStatus,
  persistLoggedInAccount,
  readAccountState,
  removeAccount,
  switchAccount,
  updateAccountIdentity,
  type XhsAccount,
} from "./xhs";

type UiStatus =
  | "starting"
  | "notLoggedIn"
  | "waitingQr"
  | "waitingScan"
  | "verifying"
  | "connected"
  | "failed";

const PRIMARY_BUTTON =
  "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-background shadow-sm transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50";
const SECONDARY_BUTTON =
  "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-muted/35 px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-muted/60 disabled:cursor-wait disabled:opacity-50";
const DANGER_BUTTON =
  "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-destructive/40 px-3.5 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-wait disabled:opacity-50";

const STATUS_META: Record<
  UiStatus,
  { tone: string; dot: string; key: string }
> = {
  starting: {
    tone: "text-muted-foreground",
    dot: "bg-muted-foreground",
    key: "starting",
  },
  notLoggedIn: {
    tone: "text-amber-300",
    dot: "bg-amber-300",
    key: "notLoggedIn",
  },
  waitingQr: { tone: "text-sky-300", dot: "bg-sky-300", key: "waitingQr" },
  waitingScan: { tone: "text-sky-300", dot: "bg-sky-300", key: "waitingScan" },
  verifying: { tone: "text-sky-300", dot: "bg-sky-300", key: "verifying" },
  connected: {
    tone: "text-emerald-300",
    dot: "bg-emerald-300",
    key: "connected",
  },
  failed: {
    tone: "text-destructive",
    dot: "bg-destructive",
    key: "failedStatus",
  },
};

const STATUS_FALLBACKS: Record<UiStatus, string> = {
  starting: "正在启动服务",
  notLoggedIn: "尚未登录",
  waitingQr: "正在获取二维码…",
  waitingScan: "等待扫码",
  verifying: "正在验证登录…",
  connected: "已登录",
  failed: "操作失败",
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isAbortError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  )
    return true;
  return messageOf(error).toLowerCase().includes("operation was aborted");
}

function errorText(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  details: string,
): string {
  return t(key, { details }).replaceAll("{{details}}", details);
}

export function formatAccountDate(
  value: string | undefined,
  locale: string,
): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatusLine({
  status,
  label,
}: {
  status: UiStatus;
  label: string;
}): ReactElement {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.tone}`}
    >
      <span
        className={`size-1.5 rounded-full ${meta.dot}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function AccountAvatar({
  account,
  size = "size-11",
}: {
  account: Pick<XhsAccount, "name" | "nickname">;
  size?: string;
}): ReactElement {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 text-sm font-semibold text-white shadow-inner`}
      aria-hidden="true"
    >
      {accountInitial(account)}
    </div>
  );
}

export function XhsSetupSlot({
  context,
  compact = false,
  allowAdd = false,
  onAccountChanged,
}: {
  context: ManagedPluginContext;
  compact?: boolean;
  allowAdd?: boolean;
  onAccountChanged?: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UiStatus>("starting");
  const [account, setAccount] = useState<XhsAccount | undefined>();
  const [qr, setQr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const disposedRef = useRef(false);
  const translatedStatus = t(`setup.${STATUS_META[status].key}`);
  const statusText =
    translatedStatus === `setup.${STATUS_META[status].key}`
      ? STATUS_FALLBACKS[status]
      : translatedStatus;

  const refresh = useCallback(async () => {
    try {
      const state = await readAccountState(context);
      const active = state.accounts.find(
        (item) => item.id === state.activeAccountId,
      );
      const current = await loginStatus(context);
      if (disposedRef.current) return;
      const synced =
        active && current.loggedIn
          ? await updateAccountIdentity(context, active.id, current)
          : undefined;
      setAccount(
        synced ??
          (active
            ? { ...active, status: current.loggedIn ? "connected" : "expired" }
            : undefined),
      );
      setStatus(current.loggedIn ? "connected" : "notLoggedIn");
    } catch (reason) {
      if (disposedRef.current || isAbortError(reason)) return;
      setStatus("failed");
      setError(messageOf(reason));
    }
  }, [context]);

  useEffect(() => {
    disposedRef.current = false;
    void ensureServiceStarted(context)
      .then(refresh)
      .catch((reason: unknown) => {
        if (disposedRef.current || isAbortError(reason)) return;
        setStatus("failed");
        setError(messageOf(reason));
      });
    return () => {
      disposedRef.current = true;
    };
  }, [context, refresh]);

  const login = useCallback(
    async (forceNew = false) => {
      setBusy(true);
      setError(undefined);
      setQr(undefined);
      try {
        await ensureServiceStarted(context);
        const existing = await loginStatus(context);
        if (disposedRef.current) return;
        if (existing.loggedIn && !forceNew) {
          await refresh();
          return;
        }
        if (existing.loggedIn && forceNew) {
          const logout = await context.services.request<unknown>("xhs", {
            path: "/api/v1/login/cookies",
            method: "DELETE",
            responseType: "json",
            timeoutMs: 10_000,
          });
          if (!logout.ok)
            throw new Error(
              `Unable to prepare another account: HTTP ${logout.status}`,
            );
        }
        const next = await beginLogin(context);
        setStatus("waitingQr");
        const payload = await context.services.request<{
          data?: Record<string, unknown>;
          url?: string;
          qrcode?: string;
          qr_code?: string;
          img?: string;
        }>("xhs", {
          path: "/api/v1/login/qrcode",
          responseType: "json",
          timeoutMs: 30_000,
        });
        const body = payload.body;
        const qrPayload =
          body.data?.url ??
          body.data?.qrcode ??
          body.data?.qr_code ??
          body.data?.img ??
          body.url ??
          body.qrcode ??
          body.qr_code ??
          body.img;
        if (typeof qrPayload !== "string" || !qrPayload)
          throw new Error("QR response did not contain a URL");
        setQr(await renderQrPayload(qrPayload));
        setStatus("waitingScan");
        const deadline = Date.now() + 180_000;
        while (!disposedRef.current && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          if (disposedRef.current) return;
          const current = await loginStatus(context);
          if (current.loggedIn) {
            setStatus("verifying");
            const saved = await persistLoggedInAccount(context, {
              ...next,
              nickname: current.nickname,
              userId: current.userId,
              name: current.nickname || next.name,
            });
            setAccount(saved);
            setQr(undefined);
            setStatus("connected");
            onAccountChanged?.();
            return;
          }
        }
        throw new Error("QR login timed out");
      } catch (reason) {
        if (disposedRef.current || isAbortError(reason)) {
          if (!disposedRef.current) {
            setStatus("starting");
            void ensureServiceStarted(context)
              .then(refresh)
              .catch(() => undefined);
          }
          return;
        }
        setStatus("failed");
        setError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    },
    [context, onAccountChanged, refresh],
  );

  const displayName = account ? accountDisplayName(account) : undefined;
  const isConnected = status === "connected";
  const actionLabel = busy
    ? t(
        `setup.${status === "waitingScan" ? "waitingScan" : status === "verifying" ? "verifying" : "waitingQr"}`,
      )
    : t(isConnected ? "setup.openAccounts" : "setup.login");

  return (
    <section
      className={
        compact
          ? "rounded-xl border border-border/60 bg-card/35 p-4"
          : "rounded-2xl border border-border/60 bg-card/45 p-5 shadow-sm"
      }
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${isConnected ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}
          aria-hidden="true"
        >
          {isConnected ? "✓" : "↗"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div>
              <p className="m-0 text-sm font-semibold text-foreground">
                {compact ? t("setup.connectionTitle") : t("setup.title")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isConnected
                  ? t("setup.connectedHint", {
                      name: displayName ?? t("setup.identityPending"),
                    })
                  : t("setup.subtitle")}
              </p>
            </div>
            <StatusLine status={status} label={statusText} />
          </div>
        </div>
      </div>
      {isConnected ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3">
          <AccountAvatar
            account={account ?? { name: t("setup.identityPending") }}
            size="size-9"
          />
          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-medium">
              {displayName ?? t("setup.identityPending")}
            </p>
            <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">
              {account?.lastCheckedAt
                ? t("setup.lastChecked", {
                    time:
                      formatAccountDate(account.lastCheckedAt, "zh-CN") ?? "—",
                  })
                : t("setup.identityPendingHint")}
            </p>
          </div>
        </div>
      ) : null}
      {qr ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-white p-4">
          <img className="size-56 rounded-lg" src={qr} alt={t("setup.qrAlt")} />
          <div className="text-center">
            <p className="m-0 text-sm font-medium text-slate-800">
              {t("setup.scanTitle")}
            </p>
            <p className="m-0 mt-1 text-xs text-slate-500">
              {t("setup.waitingScan")}
            </p>
          </div>
        </div>
      ) : null}
      {error ? (
        <p
          className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs leading-5 text-destructive"
          role="alert"
        >
          {errorText(t, "setup.failed", error)}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className={isConnected ? SECONDARY_BUTTON : PRIMARY_BUTTON}
          type="button"
          onClick={() =>
            isConnected
              ? context.ui.openWorkspaceView("accounts")
              : void login()
          }
          disabled={busy}
        >
          {actionLabel}
        </button>
        {allowAdd && isConnected ? (
          <button
            className={PRIMARY_BUTTON}
            type="button"
            onClick={() => void login(true)}
            disabled={busy}
          >
            {t("accounts.loginNew")}
          </button>
        ) : null}
        <button
          className={SECONDARY_BUTTON}
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
        >
          {t("setup.refresh")}
        </button>
        {!compact && isConnected ? (
          <button
            className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            type="button"
            onClick={() => context.ui.openWorkspaceView("accounts")}
          >
            {t("setup.openAccounts")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function AccountCard({
  account,
  active,
  busy,
  locale,
  onSwitch,
  onRemove,
  t,
}: {
  account: XhsAccount;
  active: boolean;
  busy: boolean;
  locale: string;
  onSwitch: () => void;
  onRemove: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}): ReactElement {
  const name = accountDisplayName(account);
  return (
    <article
      className={`rounded-xl border p-4 transition ${active ? "border-primary/50 bg-primary/8 shadow-sm" : "border-border/55 bg-card/30 hover:border-border"}`}
    >
      <div className="flex items-start gap-3">
        <AccountAvatar account={account} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 truncate text-sm font-semibold">
              {name ?? t("accounts.identityPending")}
            </h3>
            {active ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t("accounts.active")}
              </span>
            ) : null}
          </div>
          <StatusLine
            status={
              account.status === "connected" && active
                ? "connected"
                : account.status === "expired"
                  ? "notLoggedIn"
                  : "starting"
            }
            label={t(`accounts.status.${account.status}`)}
          />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <dt className="text-muted-foreground">{t("accounts.created")}</dt>
          <dd className="m-0 mt-1 text-foreground/80">
            {formatAccountDate(account.createdAt, locale) ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("accounts.checked")}</dt>
          <dd className="m-0 mt-1 text-foreground/80">
            {formatAccountDate(account.lastCheckedAt, locale) ?? "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-end gap-2">
        {!active ? (
          <button
            className={SECONDARY_BUTTON}
            type="button"
            onClick={onSwitch}
            disabled={busy}
          >
            {t("accounts.switch")}
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {t("accounts.currentHint")}
          </span>
        )}
        <button
          className={DANGER_BUTTON}
          type="button"
          onClick={onRemove}
          disabled={busy}
        >
          {t("accounts.remove")}
        </button>
      </div>
    </article>
  );
}

export function XhsAccountsView({
  context,
}: {
  context: ManagedPluginContext;
}): ReactElement {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<XhsAccount[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const disposedRef = useRef(false);
  const locale = "zh-CN";
  const refresh = useCallback(async () => {
    const state = await readAccountState(context);
    if (disposedRef.current) return;
    setAccounts(state.accounts);
    setActiveId(state.activeAccountId);
  }, [context]);
  useEffect(() => {
    disposedRef.current = false;
    void refresh().catch((reason: unknown) => {
      if (!disposedRef.current && !isAbortError(reason))
        setError(messageOf(reason));
    });
    return () => {
      disposedRef.current = true;
    };
  }, [refresh]);
  const activate = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(undefined);
      try {
        await switchAccount(context, id);
        await refresh();
      } catch (reason) {
        if (!disposedRef.current && !isAbortError(reason))
          setError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    },
    [context, refresh],
  );
  const remove = useCallback(
    async (account: XhsAccount) => {
      if (
        !window.confirm(
          t("accounts.removeConfirm", {
            name: accountDisplayName(account) ?? t("accounts.identityPending"),
          }),
        )
      )
        return;
      setBusy(true);
      setError(undefined);
      try {
        await removeAccount(context, account.id);
        await refresh();
      } catch (reason) {
        if (!disposedRef.current && !isAbortError(reason))
          setError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    },
    [context, refresh, t],
  );
  const active = accounts.find((account) => account.id === activeId);
  return (
    <main
      className="min-h-full bg-background px-5 py-6 text-foreground sm:px-8"
      aria-live="polite"
    >
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-border/50 pb-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
              {t("accounts.eyebrow")}
            </div>
            <h1 className="m-0 text-2xl font-semibold tracking-tight">
              {t("accounts.title")}
            </h1>
            <p className="m-0 mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {t("accounts.subtitle")}
            </p>
          </div>
        </header>
        <div className="mt-6">
          <XhsSetupSlot
            context={context}
            compact
            allowAdd
            onAccountChanged={() => void refresh()}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-card/30 p-4">
            <p className="m-0 text-xs text-muted-foreground">
              {t("accounts.currentLabel")}
            </p>
            <p className="m-0 mt-2 truncate text-lg font-semibold">
              {active
                ? (accountDisplayName(active) ?? t("accounts.identityPending"))
                : t("accounts.none")}
            </p>
            <p className="m-0 mt-1 text-[11px] text-muted-foreground">
              {active ? t("accounts.currentHint") : t("accounts.addFirst")}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/30 p-4">
            <p className="m-0 text-xs text-muted-foreground">
              {t("accounts.savedLabel")}
            </p>
            <p className="m-0 mt-2 text-lg font-semibold">{accounts.length}</p>
            <p className="m-0 mt-1 text-[11px] text-muted-foreground">
              {t("accounts.savedHint")}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/30 p-4">
            <p className="m-0 text-xs text-muted-foreground">
              {t("accounts.securityLabel")}
            </p>
            <p className="m-0 mt-2 text-lg font-semibold text-emerald-300">
              {t("accounts.localOnly")}
            </p>
            <p className="m-0 mt-1 text-[11px] text-muted-foreground">
              {t("accounts.securityHint")}
            </p>
          </div>
        </div>
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold">
                {t("accounts.savedTitle")}
              </h2>
              <p className="m-0 mt-1 text-xs text-muted-foreground">
                {t("accounts.savedSubtitle")}
              </p>
            </div>
            {accounts.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {accounts.length} / {t("accounts.accountUnit")}
              </span>
            ) : null}
          </div>
          {error ? (
            <p
              className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              role="alert"
            >
              {errorText(t, "accounts.error", error)}
            </p>
          ) : null}
          {accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/20 px-6 py-12 text-center">
              <div
                className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-xl text-primary"
                aria-hidden="true"
              >
                ＋
              </div>
              <h3 className="m-0 mt-4 text-sm font-semibold">
                {t("accounts.emptyTitle")}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
                {t("accounts.empty")}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  active={activeId === account.id}
                  busy={busy}
                  locale={locale}
                  onSwitch={() => void activate(account.id)}
                  onRemove={() => void remove(account)}
                  t={t}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
