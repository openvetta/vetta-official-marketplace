import { useEffect, useState, type ReactElement } from "react";
import { ModalDialog } from "../../../shared/components/modal-dialog";
import {
	PRIMARY_BUTTON,
	SECONDARY_BUTTON,
	type Translation,
} from "../../../shared/state/status";

export function RenameAccountDialog({
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
	t: Translation;
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
				onSubmit={(event) => {
					event.preventDefault();
					void handleConfirm();
				}}
				className="space-y-3"
			>
				<input
					type="text"
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder={t("accounts.renamePlaceholder")}
					className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
					autoFocus
				/>
			</form>
		</ModalDialog>
	);
}
