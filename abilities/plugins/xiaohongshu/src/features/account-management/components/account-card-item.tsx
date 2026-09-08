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
