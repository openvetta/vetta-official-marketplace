import { useTranslation } from "@vetta-org/plugin-sdk";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactElement,
} from "react";
import { renderQrPayload } from "../../account-connection/services/qr-code";
import { ensureServiceStarted } from "../../../runtime";
import type { ManagedPluginContext } from "../../../runtime-contract";
import {
	accountDisplayName,
	beginLogin,
	loginStatus,
	persistLoggedInAccount,
	readAccountState,
	removeAccount,
	requestQrPayload,
	renameAccount,
	SERVICE_ID,
	switchAccount,
	updateAccountIdentity,
	type XhsAccount,
} from "../../../xhs";
import { AccountAvatar } from "../../../shared/components/account-avatar";
import { StatusLine } from "../../../shared/components/status-line";
import { XhsLogo } from "../../../shared/components/xhs-logo";
import {
	errorText,
	isAbortError,
	messageOf,
	PRIMARY_BUTTON,
	SECONDARY_BUTTON,
	STATUS_FALLBACKS,
	STATUS_META,
	type UiStatus,
} from "../../../shared/state/status";
import { QrLoginDialog } from "../../account-connection/components/qr-login-dialog";
import { AccountCardItem } from "./account-card-item";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { RenameAccountDialog } from "./rename-account-dialog";

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
	const [renamingAccount, setRenamingAccount] = useState<XhsAccount | null>(
		null,
	);
	const [deletingAccount, setDeletingAccount] = useState<XhsAccount | null>(
		null,
	);

	const disposedRef = useRef(false);
	const locale = "zh-CN";

	const refresh = useCallback(async () => {
		try {
			const state = await readAccountState(context);
			if (disposedRef.current) return;
			let nextAccounts = state.accounts;
			setAccounts(nextAccounts);
			setActiveId(state.activeAccountId);

			// 同步当前在线状态
			try {
				const curLogin = await loginStatus(context);
				const active = state.accounts.find(
					(a) => a.id === state.activeAccountId,
				);
				if (active && curLogin) {
					const updated = await updateAccountIdentity(context, active.id, curLogin);
					if (updated) {
						nextAccounts = nextAccounts.map((account) => account.id === updated.id ? updated : account);
						setAccounts(nextAccounts);
					}
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
			const qrPayload = await requestQrPayload(context);

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
						avatarUrl: current.avatarUrl,
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
		t(`setup.${STATUS_META[qrStatus].key}`) ===
		`setup.${STATUS_META[qrStatus].key}`
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
							{busy
								? t("accounts.serviceRestarting")
								: t("accounts.serviceRestart")}
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
											{active.userId
												? `ID: ${active.userId}`
												: t("accounts.currentHint")}
										</p>
									</div>
								</>
							) : (
								<div className="text-xs text-muted-foreground">
									<p className="m-0 font-medium text-foreground">
										{t("accounts.none")}
									</p>
									<p className="m-0 mt-0.5 text-[11px]">
										{t("accounts.addFirst")}
									</p>
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
								<span>
									{busy
										? t("accounts.serviceRestarting")
										: t("accounts.serviceRestart")}
								</span>
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
			<RenameAccountDialog
				isOpen={Boolean(renamingAccount)}
				initialName={
					renamingAccount
						? (accountDisplayName(renamingAccount) ?? renamingAccount.name)
						: ""
				}
				onClose={() => setRenamingAccount(null)}
				onSave={handleSaveRename}
				t={t}
			/>

			{/* 弹窗层：删除确认弹窗 */}
			<DeleteAccountDialog
				isOpen={Boolean(deletingAccount)}
				accountName={
					deletingAccount
						? (accountDisplayName(deletingAccount) ??
							t("accounts.identityPending"))
						: ""
				}
				onClose={() => setDeletingAccount(null)}
				onConfirm={handleConfirmDelete}
				t={t}
			/>
		</main>
	);
}
