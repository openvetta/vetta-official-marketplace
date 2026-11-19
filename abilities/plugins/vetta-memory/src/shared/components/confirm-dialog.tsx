import { Button } from "@vetta-org/ui";
import type { ReactElement } from "react";
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
                    <Button variant="outline" onClick={onClose}>
                        {cancelLabel}
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">{message}</p>
        </ModalDialog>
    );
}
