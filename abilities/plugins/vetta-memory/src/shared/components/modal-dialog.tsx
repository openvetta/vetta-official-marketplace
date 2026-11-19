import { Button, Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@vetta-org/ui";
import type { ReactElement, ReactNode } from "react";

/** Shell for every dialog on the Memory page: the host's own modal, so focus and Escape come from Vetta. */
export function ModalDialog({
    title,
    closeLabel,
    onClose,
    children,
    footer,
}: {
    title: string;
    closeLabel: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
}): ReactElement {
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent showCloseButton={false} aria-describedby={undefined} className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <DialogClose asChild>
                    <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" aria-label={closeLabel}>
                        <span className="icon-[solar--close-circle-linear] size-4" />
                    </Button>
                </DialogClose>
                <div className="max-h-[60vh] min-h-0 overflow-y-auto">{children}</div>
                {footer ? <div className="flex justify-end gap-2">{footer}</div> : null}
            </DialogContent>
        </Dialog>
    );
}
