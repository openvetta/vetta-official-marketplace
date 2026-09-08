import { useTranslation } from "@vetta-org/plugin-sdk";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
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
  renameAccount,
  switchAccount,
  updateAccountIdentity,
  SERVICE_ID,
  type XhsAccount,
} from "./xhs";

export type UiStatus =
  | "starting"
  | "notLoggedIn"
  | "waitingQr"
  | "waitingScan"
  | "verifying"
  | "connected"
  | "failed";

const PRIMARY_BUTTON =
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition-all hover:from-rose-600 hover:to-red-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50";

const SECONDARY_BUTTON =
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3.5 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted/60 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50";

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
    dot: "bg-emerald-400 animate-pulse",
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

/* 品牌红小红书 LOGO 徽标 */
function XhsLogo({ size = "size-5" }: { size?: string }): ReactElement {
  return (
    <div
      className={`inline-flex ${size} shrink-0 items-center justify-center rounded-lg bg-[#ff2442] text-white font-black text-xs shadow-sm`}
      aria-hidden="true"
    >
      小
    </div>
  );
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
      <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function AccountAvatar({
  account,
  size = "size-10",
}: {
  account: Pick<XhsAccount, "name" | "nickname">;
  size?: string;
}): ReactElement {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-sm font-bold text-white shadow-sm ring-1 ring-white/10`}
      aria-hidden="true"
    >
      {accountInitial(account)}
    </div>
  );
}

/* 模态对话框 */
function ModalDialog({
  title,
  description,
  onClose,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}): ReactElement {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`flex w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl outline-none`}
      >
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="min-w-0 pr-3">
            <h3 className="m-0 truncate text-sm font-semibold text-foreground">
              {title}
            </h3>
            {description ? (
              <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <span className="text-base leading-none">✕</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/15 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/* 扫码登录弹窗 */
function QrLoginDialog({
  isOpen,
  onClose,
  qr,
  status,
  statusText,
  error,
  busy,
  onRefreshQr,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  qr?: string;
  status: UiStatus;
  statusText: string;
  error?: string;
  busy: boolean;
  onRefreshQr: () => void;
  t: (key: string) => string;
}): ReactElement | null {
  if (!isOpen) return null;

  return (
    <ModalDialog
      title={t("accounts.qrDialogTitle")}
      description={t("accounts.qrDialogSubtitle")}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            onClick={onRefreshQr}
            disabled={busy}
          >
            <span
              className={`icon-[solar--refresh-linear] size-3.5 ${busy ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {t("accounts.qrRefresh")}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={onClose}
          >
            {t("accounts.cancel")}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative flex size-56 items-center justify-center rounded-2xl border border-rose-500/25 bg-white p-3 shadow-xl shadow-rose-500/10">
          {qr ? (
            <img
              src={qr}
              alt={t("setup.qrAlt")}
              className="size-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2.5 text-muted-foreground">
              <span className="inline-block size-7 animate-spin rounded-full border-2 border-rose-500 border-r-transparent" />
              <span className="text-xs font-medium text-slate-600">{statusText}</span>
            </div>
          )}
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <StatusLine status={status} label={statusText} />
        </div>

        {error ? (
          <p className="mt-2 w-full rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-4 w-full rounded-xl border border-border/60 bg-muted/25 p-3.5 text-left text-xs">
          <div className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <XhsLogo size="size-4" />
            <span>小红书 App 扫码指引</span>
          </div>
          <ol className="space-y-1.5 pl-4 text-muted-foreground list-decimal">
            <li>{t("accounts.qrStep1")}</li>
            <li>{t("accounts.qrStep2")}</li>
            <li>{t("accounts.qrStep3")}</li>
          </ol>
        </div>
      </div>
    </ModalDialog>
  );
}

/* 账号备注修改弹窗 */
function RenameModal({
  isOpen,
  initialName,
  onClose,
  onSave,
  t,
}: {
  isOpen: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  t: (key: string) => string;
}): ReactElement | null {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(initialName);
  }, [initialName, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      title={t("accounts.renameTitle")}
      description={t("accounts.renamePlaceholder")}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={onClose}
            disabled={saving}
          >
            {t("accounts.cancel")}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => void handleConfirm()}
            disabled={saving || !name.trim()}
          >
            {saving ? "…" : t("accounts.save")}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleConfirm();
        }}
        className="space-y-3"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("accounts.renamePlaceholder")}
          className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          autoFocus
        />
      </form>
    </ModalDialog>
  );
}

/* 账号删除确认弹窗 */
function DeleteConfirmModal({
  isOpen,
  accountName,
  onClose,
  onConfirm,
  t,
}: {
  isOpen: boolean;
  accountName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  t: (key: string, params?: Record<string, string>) => string;
}): ReactElement | null {
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  return (
    <ModalDialog
      title={t("accounts.deleteTitle")}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={onClose}
            disabled={busy}
          >
            {t("accounts.cancel")}
          </button>
          <button
            type="button"
            className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg bg-destructive px-3.5 py-2 text-xs font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            {busy ? "…" : t("accounts.remove")}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3 py-1">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
          <span className="icon-[solar--trash-bin-trash-linear] size-5" aria-hidden="true" />
        </div>
        <p className="m-0 text-xs leading-5 text-muted-foreground">
          {t("accounts.deleteWarning", { name: accountName })}
        </p>
      </div>
    </ModalDialog>
  );
}

/* 能力详情页插槽卡片 (SetupSlot) */
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
      const synced = active
        ? await updateAccountIdentity(context, active.id, current)
        : undefined;
      setAccount(
        synced ??
          (active
            ? { ...active, status: current.loggedIn ? "connected" : "expired" }
            : undefined),
      );
      setStatus(current.loggedIn ? "connected" : "notLoggedIn");
      if (active) onAccountChanged?.();
    } catch (reason) {
      if (disposedRef.current || isAbortError(reason)) return;
      setStatus("failed");
      setError(messageOf(reason));
    }
  }, [context, onAccountChanged]);

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
          ? "rounded-xl border border-border/60 bg-card/40 px-3.5 py-3 shadow-xs"
          : "rounded-2xl border border-border/60 bg-card/50 p-5 shadow-sm"
      }
      aria-live="polite"
    >
      <div
        className={`flex ${compact ? "items-center gap-3" : "items-start gap-3.5"}`}
      >
        <div
          className={`flex shrink-0 items-center justify-center ${compact ? "size-9 rounded-xl" : "size-11 rounded-2xl"} ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20"
          }`}
          aria-hidden="true"
        >
          {isConnected ? (
            <span className="text-sm font-bold">✓</span>
          ) : (
            <XhsLogo size="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className={compact ? "flex min-w-0 items-center gap-2" : undefined}>
              <p className="m-0 shrink-0 text-sm font-semibold text-foreground">
                {compact ? t("setup.connectionTitle") : t("setup.title")}
              </p>
              <p
                className={`${compact ? "m-0 truncate" : "mt-1"} text-xs text-muted-foreground`}
              >
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

      {isConnected && !compact ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <AccountAvatar
            account={account ?? { name: t("setup.identityPending") }}
            size="size-9"
          />
          <div className="min-w-0 flex-1">
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
          <img className="size-52 rounded-lg" src={qr} alt={t("setup.qrAlt")} />
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

      <div
        className={`${compact ? "mt-2.5" : "mt-4"} flex flex-wrap items-center gap-2`}
      >
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
            <span
              className="icon-[solar--user-plus-linear] size-3.5"
              aria-hidden="true"
            />
            {t("accounts.loginNew")}
          </button>
        ) : null}
        <button
          className={SECONDARY_BUTTON}
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
        >
          <span
            className="icon-[solar--refresh-linear] size-3.5"
            aria-hidden="true"
          />
          {t("setup.refresh")}
        </button>
        {!compact && isConnected ? (
          <button
            className="ml-auto cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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

/* 账号卡片组件 */
function AccountCardItem({
  account,
  active,
  busy,
  locale,
  onSwitch,
  onRename,
  onRemove,
  t,
}: {
  account: XhsAccount;
  active: boolean;
  busy: boolean;
  locale: string;
  onSwitch: () => void;
  onRename: () => void;
  onRemove: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}): ReactElement {
  const [copied, setCopied] = useState(false);
  const name = accountDisplayName(account);

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!account.userId) return;
    void navigator.clipboard.writeText(account.userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article
      className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:gap-4 ${
        active
          ? "border-rose-500/40 bg-gradient-to-r from-rose-500/[0.07] via-rose-500/[0.02] to-transparent shadow-sm ring-1 ring-rose-500/15"
          : "border-border/65 bg-card/40 hover:border-border hover:bg-card/70"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:items-center">
        <AccountAvatar account={account} size="size-11" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 truncate text-sm font-semibold text-foreground">
              {name ?? t("accounts.identityPending")}
            </h3>
            {active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-500 ring-1 ring-rose-500/20">
                <span className="size-1.5 rounded-full bg-rose-500" />
                {t("accounts.activeBadge")}
              </span>
            ) : null}
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

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {account.userId ? (
              <button
                type="button"
                onClick={handleCopyId}
                title="点击复制用户 ID"
                className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-muted-foreground transition hover:text-foreground"
              >
                <span>ID: {account.userId}</span>
                <span className="text-[10px] opacity-70">
                  {copied ? "✓ 已复制" : "📋"}
                </span>
              </button>
            ) : null}
            <span className="text-[11px]">
              {t("accounts.checked")}:{" "}
              {formatAccountDate(account.lastCheckedAt, locale) ?? "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-end gap-1.5 border-t border-border/40 pt-3 sm:mt-0 sm:border-0 sm:pt-0">
        {!active ? (
          <button
            className={`${PRIMARY_BUTTON} min-h-8 px-3 py-1.5 text-xs`}
            type="button"
            onClick={onSwitch}
            disabled={busy}
          >
            <span
              className="icon-[solar--alt-arrow-right-linear] size-3.5"
              aria-hidden="true"
            />
            {t("accounts.switch")}
          </button>
        ) : null}

        <button
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          type="button"
          onClick={onRename}
          disabled={busy}
          title={t("accounts.renameTitle")}
          aria-label={t("accounts.renameTitle")}
        >
          <span className="text-xs">✎</span>
        </button>

        <button
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          type="button"
          onClick={onRemove}
          disabled={busy}
          title={t("accounts.remove")}
          aria-label={t("accounts.remove")}
        >
          <span
            className="icon-[solar--trash-bin-trash-linear] size-4"
            aria-hidden="true"
          />
        </button>
      </div>
    </article>
  );
}

/* 主工作区视图 (Workspace View) */
export function XhsAccountsView({
  context,
}: {
  context: ManagedPluginContext;
}): ReactElement {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<XhsAccount[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [serviceError, setServiceError] = useState<string>();
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string>();
  const [qrStatus, setQrStatus] = useState<UiStatus>("waitingQr");
  const [qrError, setQrError] = useState<string>();
  const [renamingAccount, setRenamingAccount] = useState<XhsAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<XhsAccount | null>(null);

  const disposedRef = useRef(false);
  const locale = "zh-CN";

  const refresh = useCallback(async () => {
    try {
      const state = await readAccountState(context);
      if (disposedRef.current) return;
      setAccounts(state.accounts);
      setActiveId(state.activeAccountId);

      // 同步当前在线状态
      try {
        const curLogin = await loginStatus(context);
        const active = state.accounts.find((a) => a.id === state.activeAccountId);
        if (active && curLogin) {
          await updateAccountIdentity(context, active.id, curLogin);
        }
      } catch {
        // 后台若未完全 ready，不阻断界面渲染
      }
    } catch (reason) {
      if (!disposedRef.current && !isAbortError(reason))
        setServiceError(messageOf(reason));
    }
  }, [context]);

  useEffect(() => {
    disposedRef.current = false;
    void ensureServiceStarted(context)
      .then(refresh)
      .catch((reason: unknown) => {
        if (!disposedRef.current && !isAbortError(reason)) {
          setServiceError(messageOf(reason));
        }
      });
    return () => {
      disposedRef.current = true;
    };
  }, [context, refresh]);

  /* 切换账号 */
  const activate = useCallback(
    async (id: string) => {
      setBusy(true);
      setServiceError(undefined);
      try {
        await switchAccount(context, id);
        await refresh();
      } catch (reason) {
        if (!disposedRef.current && !isAbortError(reason))
          setServiceError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    },
    [context, refresh],
  );

  /* 重命名账号 */
  const handleSaveRename = useCallback(
    async (newName: string) => {
      if (!renamingAccount) return;
      try {
        await renameAccount(context, renamingAccount.id, newName);
        await refresh();
      } catch (reason) {
        setServiceError(messageOf(reason));
      }
    },
    [context, renamingAccount, refresh],
  );

  /* 删除账号 */
  const handleConfirmDelete = useCallback(async () => {
    if (!deletingAccount) return;
    setBusy(true);
    try {
      await removeAccount(context, deletingAccount.id);
      await refresh();
    } catch (reason) {
      if (!disposedRef.current && !isAbortError(reason))
        setServiceError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }, [context, deletingAccount, refresh]);

  /* 启动扫码登录流程 */
  const startLoginFlow = useCallback(async () => {
    setQrModalOpen(true);
    setQrStatus("waitingQr");
    setQrError(undefined);
    setQrCodeData(undefined);
    setBusy(true);

    try {
      await ensureServiceStarted(context);
      const next = await beginLogin(context);
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

      if (typeof qrPayload !== "string" || !qrPayload) {
        throw new Error("二维码获取失败，请重试");
      }

      setQrCodeData(await renderQrPayload(qrPayload));
      setQrStatus("waitingScan");

      // 轮询等待扫码结果
      const deadline = Date.now() + 180_000;
      while (!disposedRef.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (disposedRef.current) return;
        const current = await loginStatus(context);
        if (current.loggedIn) {
          setQrStatus("verifying");
          await persistLoggedInAccount(context, {
            ...next,
            nickname: current.nickname,
            userId: current.userId,
            name: current.nickname || next.name,
          });
          setQrModalOpen(false);
          await refresh();
          return;
        }
      }
      throw new Error(t("accounts.qrExpired"));
    } catch (reason) {
      if (!disposedRef.current && !isAbortError(reason)) {
        setQrStatus("failed");
        setQrError(messageOf(reason));
      }
    } finally {
      setBusy(false);
    }
  }, [context, refresh, t]);

  /* 重启服务 */
  const handleRestartService = useCallback(async () => {
    setBusy(true);
    setServiceError(undefined);
    try {
      await context.services.stop(SERVICE_ID);
      await context.services.start(SERVICE_ID);
      await refresh();
    } catch (reason) {
      setServiceError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }, [context, refresh]);

  const active = accounts.find((account) => account.id === activeId);
  const activeName = active ? accountDisplayName(active) : undefined;
  const qrStatusText =
    t(`setup.${STATUS_META[qrStatus].key}`) === `setup.${STATUS_META[qrStatus].key}`
      ? STATUS_FALLBACKS[qrStatus]
      : t(`setup.${STATUS_META[qrStatus].key}`);

  return (
    <main
      className="min-h-full bg-background px-5 py-6 text-foreground sm:px-8"
      aria-live="polite"
    >
      <div className="mx-auto max-w-5xl">
        {/* 顶部 Header 区域 */}
        <header className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
              <XhsLogo size="size-4" />
              <span>{t("accounts.eyebrow")}</span>
            </div>
            <h1 className="m-0 text-2xl font-bold tracking-tight text-foreground">
              {t("accounts.title")}
            </h1>
            <p className="m-0 mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {t("accounts.subtitle")}
            </p>
          </div>

          {/* 顶部全局操作栏 */}
          <div className="flex shrink-0 items-center gap-2.5">
            <button
              className={PRIMARY_BUTTON}
              type="button"
              onClick={() => void startLoginFlow()}
              disabled={busy}
            >
              <span
                className="icon-[solar--user-plus-linear] size-4"
                aria-hidden="true"
              />
              {t("accounts.loginNew")}
            </button>
            <button
              className={SECONDARY_BUTTON}
              type="button"
              onClick={() => void refresh()}
              disabled={busy}
              title={t("setup.refresh")}
            >
              <span
                className={`icon-[solar--refresh-linear] size-4 ${busy ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t("setup.refresh")}
            </button>
          </div>
        </header>

        {/* 错误或服务异常告警 */}
        {serviceError ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <span className="font-semibold">⚠️</span>
              <span>{errorText(t, "accounts.error", serviceError)}</span>
            </div>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-destructive/20 px-2.5 py-1 font-medium transition hover:bg-destructive/30"
              onClick={() => void handleRestartService()}
              disabled={busy}
            >
              {busy ? t("accounts.serviceRestarting") : t("accounts.serviceRestart")}
            </button>
          </div>
        ) : null}

        {/* 3 张 KPI / 状态概览卡片 */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* 卡片 1：当前活跃账号 */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/45 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("accounts.statActive")}</span>
              <span className="font-mono text-[10px]">CURRENT</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {active ? (
                <>
                  <AccountAvatar account={active} size="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-semibold text-foreground">
                      {activeName ?? t("accounts.identityPending")}
                    </p>
                    <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">
                      {active.userId ? `ID: ${active.userId}` : t("accounts.currentHint")}
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  <p className="m-0 font-medium text-foreground">
                    {t("accounts.none")}
                  </p>
                  <p className="m-0 mt-0.5 text-[11px]">{t("accounts.addFirst")}</p>
                </div>
              )}
            </div>
            <div className="mt-3 border-t border-border/40 pt-2 text-[11px]">
              {active ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t(`accounts.status.${active.status}`)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void startLoginFlow()}
                  className="cursor-pointer font-medium text-rose-500 hover:underline"
                >
                  {t("accounts.loginNew")} →
                </button>
              )}
            </div>
          </div>

          {/* 卡片 2：后台 MCP 服务 */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/45 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("accounts.statService")}</span>
              <span className="font-mono text-[10px]">RUNTIME</span>
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="text-sm font-semibold text-foreground">
                  {t("accounts.serviceRunning")}
                </span>
              </div>
              <p className="m-0 mt-1 text-[11px] text-muted-foreground">
                小红书 MCP 插件守护进程正常
              </p>
            </div>
            <div className="mt-3 border-t border-border/40 pt-2">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                onClick={() => void handleRestartService()}
                disabled={busy}
              >
                <span>↻</span>
                <span>{busy ? t("accounts.serviceRestarting") : t("accounts.serviceRestart")}</span>
              </button>
            </div>
          </div>

          {/* 卡片 3：账号池统计 */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card/45 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("accounts.statSaved")}</span>
              <span className="font-mono text-[10px]">SECURITY</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {accounts.length}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("accounts.accountUnit")}
              </span>
            </div>
            <div className="mt-3 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
              <span>{t("accounts.securityHint")}</span>
            </div>
          </div>
        </div>

        {/* 账号列表 Section */}
        <section className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 className="m-0 text-sm font-semibold text-foreground">
                {t("accounts.savedTitle")}
              </h2>
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {accounts.length}
              </span>
              {active ? (
                <div className="flex items-center gap-2 border-l border-border/70 pl-2.5 text-xs text-muted-foreground">
                  <span>{t("accounts.currentLabel")}:</span>
                  <span className="font-medium text-foreground">
                    {activeName ?? t("accounts.identityPending")}
                  </span>
                  <StatusLine
                    status={
                      active.status === "connected"
                        ? "connected"
                        : "notLoggedIn"
                    }
                    label={t(`accounts.status.${active.status}`)}
                  />
                </div>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {t("accounts.savedSubtitle")}
            </span>
          </div>

          {accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/25 px-6 py-12 text-center">
              <div
                className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20"
                aria-hidden="true"
              >
                <XhsLogo size="size-7" />
              </div>
              <h3 className="m-0 mt-4 text-sm font-semibold text-foreground">
                {t("accounts.emptyTitle")}
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-muted-foreground">
                {t("accounts.emptyDesc")}
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  onClick={() => void startLoginFlow()}
                  disabled={busy}
                >
                  <span
                    className="icon-[solar--user-plus-linear] size-3.5"
                    aria-hidden="true"
                  />
                  {t("accounts.emptyCta")}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {accounts.map((account) => (
                <AccountCardItem
                  key={account.id}
                  account={account}
                  active={activeId === account.id}
                  busy={busy}
                  locale={locale}
                  onSwitch={() => void activate(account.id)}
                  onRename={() => setRenamingAccount(account)}
                  onRemove={() => setDeletingAccount(account)}
                  t={t}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 弹窗层：扫码登录弹窗 */}
      <QrLoginDialog
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        qr={qrCodeData}
        status={qrStatus}
        statusText={qrStatusText}
        error={qrError}
        busy={busy}
        onRefreshQr={() => void startLoginFlow()}
        t={t}
      />

      {/* 弹窗层：修改备注弹窗 */}
      <RenameModal
        isOpen={Boolean(renamingAccount)}
        initialName={renamingAccount ? accountDisplayName(renamingAccount) ?? renamingAccount.name : ""}
        onClose={() => setRenamingAccount(null)}
        onSave={handleSaveRename}
        t={t}
      />

      {/* 弹窗层：删除确认弹窗 */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingAccount)}
        accountName={
          deletingAccount
            ? accountDisplayName(deletingAccount) ?? t("accounts.identityPending")
            : ""
        }
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleConfirmDelete}
        t={t}
      />
    </main>
  );
}
