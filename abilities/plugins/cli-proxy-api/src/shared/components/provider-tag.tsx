import { type ReactElement } from "react";

/** The channel name, set as a compact uppercase marker rather than body text. */
export function ProviderTag({ children }: { children: ReactElement | string }): ReactElement {
  return (
    <span className="inline-flex items-center rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}
