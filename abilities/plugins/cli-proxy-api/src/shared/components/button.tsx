import { type ButtonHTMLAttributes, type ReactElement } from "react";

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
