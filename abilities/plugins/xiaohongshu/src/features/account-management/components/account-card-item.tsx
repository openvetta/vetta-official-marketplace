import type { MouseEvent, ReactElement } from "react";
import { accountDisplayName, type XhsAccount } from "../../../xhs";
import { AccountAvatar } from "../../../shared/components/account-avatar";
import { StatusLine } from "../../../shared/components/status-line";
import {
	formatAccountDate,
	PRIMARY_BUTTON,
	type Translation,
} from "../../../shared/state/status";
import { useCopyAccountId } from "../hooks/use-copy-account-id";

/* 账号卡片组件 */
export function AccountCardItem({
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
	t: Translation;
}): ReactElement {
	const name = accountDisplayName(account);
	const { copied, copy } = useCopyAccountId(account.userId);

	const handleCopyId = (e: MouseEvent) => {
		e.stopPropagation();
		copy();
	};

	return (
		<article
			className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
				active
					? "border-rose-500/40 bg-gradient-to-b from-rose-500/[0.08] via-rose-500/[0.02] to-card/50 shadow-xs ring-1 ring-rose-500/20"
					: "border-border/65 bg-card/40 hover:border-border/90 hover:bg-card/75 hover:shadow-xs"
			}`}
		>
			<div>
				{/* 头部：头像、昵称与激活徽标 */}
				<div className="flex items-start justify-between gap-2.5">
					<div className="flex min-w-0 items-center gap-3">
						<AccountAvatar account={account} size="size-10" />
						<div className="min-w-0 flex-1">
							<h3
								className="m-0 truncate text-sm font-semibold text-foreground"
								title={name ?? t("accounts.identityPending")}
							>
								{name ?? t("accounts.identityPending")}
							</h3>
							<div className="mt-1 flex items-center gap-2">
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
					</div>
					{active ? (
						<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-500 ring-1 ring-rose-500/20">
							<span className="size-1.5 rounded-full bg-rose-500" />
							{t("accounts.activeBadge")}
						</span>
					) : null}
				</div>

				{/* 信息区：用户 ID 与最近验证时间 */}
				<div className="mt-3.5 space-y-1.5 rounded-lg bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
					{account.userId ? (
						<div className="flex items-center justify-between">
							<span className="text-[11px] text-muted-foreground/80">ID</span>
							<button
								type="button"
								onClick={handleCopyId}
								title="点击复制用户 ID"
								className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-muted-foreground transition hover:text-foreground"
							>
								<span>{account.userId}</span>
								<span className="text-[10px] opacity-70">
									<span
										className={`icon-[solar--${copied ? "check" : "copy"}-linear] size-3`}
										aria-hidden="true"
									/>
									<span className="sr-only">
										{copied ? "已复制" : "复制用户 ID"}
									</span>
								</span>
							</button>
						</div>
					) : null}
					<div className="flex items-center justify-between text-[11px]">
						<span className="text-muted-foreground/80">{t("accounts.checked")}</span>
						<span className="text-foreground/80">
							{formatAccountDate(account.lastCheckedAt, locale) ?? "—"}
						</span>
					</div>
				</div>
			</div>

			{/* 底部操作栏 */}
			<div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
				<div>
					{!active ? (
						<button
							className={`${PRIMARY_BUTTON} min-h-7.5 px-3 py-1 text-xs`}
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
					) : (
						<span className="text-[11px] text-muted-foreground/75">
							{t("accounts.activeSession")}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1.5">
					<button
						className="inline-flex size-7.5 cursor-pointer items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
						type="button"
						onClick={onRename}
						disabled={busy}
						title={t("accounts.renameTitle")}
						aria-label={t("accounts.renameTitle")}
					>
						<span
							className="icon-[solar--pen-2-linear] size-3.5"
							aria-hidden="true"
						/>
					</button>

					<button
						className="inline-flex size-7.5 cursor-pointer items-center justify-center rounded-lg border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
						type="button"
						onClick={onRemove}
						disabled={busy}
						title={t("accounts.remove")}
						aria-label={t("accounts.remove")}
					>
						<span
							className="icon-[solar--trash-bin-trash-linear] size-3.5"
							aria-hidden="true"
						/>
					</button>
				</div>
			</div>
		</article>
	);
}
