import type { ButtonHTMLAttributes, ReactElement } from "react";

/** Shared primitives so the detail slot and the workspace view stay visually identical. */

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Spin(): ReactElement {
  return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]" aria-hidden="true" />;
}

export function ServiceIcon(): ReactElement {
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20" aria-hidden="true">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8.5h14M5 15.5h14" /><circle cx="8" cy="8.5" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="15.5" r="1" fill="currentColor" stroke="none" /><rect x="3" y="4" width="18" height="16" rx="4" />
      </svg>
    </span>
  );
}

export function ActionIcon({ name }: { name: "sync" | "restart" | "open" | "remove" }): ReactElement {
  const path = name === "sync"
    ? <><path d="M20 7h-5V2" /><path d="M20 7a8 8 0 1 0 1 7" /></>
    : name === "restart"
      ? <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>
      : name === "open"
        ? <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>
        : <><path d="M4 7h16M9 7V4h6v3M8 11v6M12 11v6M16 11v6M6 7l1 14h10l1-14" /></>;
  return <svg className="h-3.5 w-3.5" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}
