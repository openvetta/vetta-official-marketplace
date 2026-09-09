import { useTranslation } from "@vetta-org/plugin-sdk";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactElement,
} from "react";
import { renderQrPayload } from "../services/qr-code";
import { ensureServiceStarted } from "../../../runtime";
import type { ManagedPluginContext } from "../../../runtime-contract";
import {
	accountDisplayName,
	beginLogin,
	loginStatus,
	persistLoggedInAccount,
	requestQrPayload,
	readAccountState,
	updateAccountIdentity,
	type XhsAccount,
} from "../../../xhs";
import {
	errorText,
	formatAccountDate,
	isAbortError,
	messageOf,
	PRIMARY_BUTTON,
	SECONDARY_BUTTON,
	STATUS_FALLBACKS,
	STATUS_META,
	type UiStatus,
} from "../../../shared/state/status";
import { AccountAvatar } from "../../../shared/components/account-avatar";
import { StatusLine } from "../../../shared/components/status-line";
import { XhsLogo } from "../../../shared/components/xhs-logo";

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
				const qrPayload = await requestQrPayload(context);
				setQr(await renderQrPayload(qrPayload));
				setStatus("waitingScan");
				const deadline = Date.now() + 180_000;
				while (!disposedRef.current && Date.now() < deadline) {
					await new Promise((resolve) => setTimeout(resolve, 1500));
					if (disposedRef.current) return;
					const current = await loginStatus(context);
					if (current.loggedIn) {
						// Hide the one-time QR as soon as the service confirms the scan.
						// Profile persistence can take another request and must not leave
						// an apparently active QR code on screen during that interval.
						setQr(undefined);
						setStatus("verifying");
						const saved = await persistLoggedInAccount(context, {
							...next,
								nickname: current.nickname,
								userId: current.userId,
								avatarUrl: current.avatarUrl,
							name: next.name,
						});
						setAccount(saved);
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
						<div
							className={
								compact ? "flex min-w-0 items-center gap-2" : undefined
							}
						>
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

			{qr && (status === "waitingQr" || status === "waitingScan") ? (
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
