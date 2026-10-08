import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

/**
 * A modal the plugin owns end to end.
 *
 * It renders inside the plugin's own subtree rather than a portal so the host's
 * CSS scope and i18n context still apply, and it keeps the three things a modal
 * has to get right: Escape closes it, focus starts inside it and returns to
 * where it came from, and a click on the backdrop dismisses it.
 */
export function Dialog({
  title, description, onClose, children, footer
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}): ReactElement {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl outline-none"
      >
        <header className="shrink-0 border-b border-border/50 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p> : null}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-border/50 px-4 py-2.5">{footer}</footer> : null}
      </div>
    </div>
  );
}
