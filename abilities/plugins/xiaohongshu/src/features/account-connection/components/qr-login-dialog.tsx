import type { ReactElement } from "react";
import { ModalDialog } from "../../../shared/components/modal-dialog";
import { StatusLine } from "../../../shared/components/status-line";
import { XhsLogo } from "../../../shared/components/xhs-logo";
import {
	SECONDARY_BUTTON,
	type Translation,
	type UiStatus,
} from "../../../shared/state/status";

/* 扫码登录弹窗 */
export function QrLoginDialog({
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
	t: Translation;
}): ReactElement | null {
	if (!isOpen) return null;
	const showQr = Boolean(
		qr && (status === "waitingQr" || status === "waitingScan"),
	);

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
					<button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
						{t("accounts.cancel")}
					</button>
				</div>
			}
		>
			<div className="flex flex-col items-center text-center">
				<div className="relative flex size-56 items-center justify-center rounded-2xl border border-rose-500/25 bg-white p-3 shadow-xl shadow-rose-500/10">
					{showQr ? (
						<img
							src={qr}
							alt={t("setup.qrAlt")}
							className="size-full rounded-lg object-contain"
						/>
					) : (
						<div className="flex flex-col items-center gap-2.5 text-muted-foreground">
							<span className="inline-block size-7 animate-spin rounded-full border-2 border-rose-500 border-r-transparent" />
							<span className="text-xs font-medium text-slate-600">
								{statusText}
							</span>
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
