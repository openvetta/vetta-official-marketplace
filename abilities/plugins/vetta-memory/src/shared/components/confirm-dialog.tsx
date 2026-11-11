import type { ReactElement } from "react";
import { DANGER_BUTTON, SECONDARY_BUTTON } from "../styles/controls";
import { ModalDialog } from "./modal-dialog";

export function ConfirmDialog({
    title,
    message,
    confirmLabel,
    cancelLabel,
    closeLabel,
    onConfirm,
    onClose,
}: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    closeLabel: string;
    onConfirm: () => void;
    onClose: () => void;
}): ReactElement {
    return (
        <ModalDialog
            title={title}
            closeLabel={closeLabel}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
                        {cancelLabel}
                    </button>
                    <button type="button" className={DANGER_BUTTON} onClick={onConfirm}>
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">{message}</p>
        </ModalDialog>
    );
}
