import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

/** Overlay confined to the page root (`relative`), never the window. */
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
    const panel = useRef<HTMLDivElement>(null);
    // Callers pass a fresh onClose every render; keeping it in a ref stops the
    // effect below from re-running (and stealing focus from inputs) on each keystroke.
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                closeRef.current();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl outline-none"
            >
                <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                    <h3 className="m-0 text-sm font-semibold">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                        className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <span className="icon-[solar--close-circle-linear] size-4" />
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer ? <footer className="flex justify-end gap-2 border-t border-border/60 px-5 py-3">{footer}</footer> : null}
            </div>
        </div>
    );
}
