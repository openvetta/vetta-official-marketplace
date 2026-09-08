import { useState, type ReactElement } from "react";
import { ModalDialog } from "../../../shared/components/modal-dialog";
import {
	SECONDARY_BUTTON,
	type Translation,
} from "../../../shared/state/status";

export function DeleteAccountDialog({
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
	t: Translation;
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
					<span
						className="icon-[solar--trash-bin-trash-linear] size-5"
						aria-hidden="true"
					/>
				</div>
				<p className="m-0 text-xs leading-5 text-muted-foreground">
					{t("accounts.deleteWarning", { name: accountName })}
				</p>
			</div>
		</ModalDialog>
	);
}
