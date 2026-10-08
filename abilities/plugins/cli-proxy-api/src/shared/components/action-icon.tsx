import { type ReactElement } from "react";

export function ActionIcon({ name }: { name: "sync" | "restart" | "open" | "remove" | "models" | "reset" | "plus" | "app-reload" }): ReactElement {
  const path = name === "sync"
    ? <><path d="M20 7h-5V2" /><path d="M20 7a8 8 0 1 0 1 7" /></>
    : name === "restart"
      ? <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>
      : name === "open"
        ? <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>
        : name === "models"
          ? <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6.5" r="2.5" /><circle cx="18" cy="17.5" r="2.5" /><path d="m8.2 10.9 7.4-3.2M8.2 13.1l7.4 3.2" /></>
          : name === "reset"
            ? <><path d="M4 13a8 8 0 1 0 2.3-5.7" /><path d="M4 4v7h7" /></>
            : name === "plus"
              ? <><path d="M12 5v14M5 12h14" /></>
              : name === "app-reload"
                ? <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9h18" /><path d="M14.5 15.5a3 3 0 1 1-.9-3.4" /><path d="M15 11.5v2.5h-2.5" /></>
              : <><path d="M4 7h16M9 7V4h6v3M8 11v6M12 11v6M16 11v6M6 7l1 14h10l1-14" /></>;
  return <svg className="h-3.5 w-3.5" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}
