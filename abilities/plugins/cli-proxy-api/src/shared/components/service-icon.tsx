import { type ReactElement } from "react";

export function ServiceIcon(): ReactElement {
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20" aria-hidden="true">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8.5h14M5 15.5h14" /><circle cx="8" cy="8.5" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="15.5" r="1" fill="currentColor" stroke="none" /><rect x="3" y="4" width="18" height="16" rx="4" />
      </svg>
    </span>
  );
}
