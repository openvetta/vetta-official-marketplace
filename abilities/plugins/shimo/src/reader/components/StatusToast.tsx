import type { ReactElement } from "react";
import type { ReaderNotice } from "../types";

export function StatusToast({ notice }: { notice: ReaderNotice }): ReactElement {
  const toneClass = notice.tone === "error"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : notice.tone === "success"
      ? "border-primary/25 bg-primary/10 text-primary"
      : "border-border/65 bg-popover/95 text-popover-foreground";

  return (
    <div role={notice.tone === "error" ? "alert" : "status"} className={`absolute right-4 bottom-4 z-40 max-w-sm rounded-xl border px-3.5 py-2.5 text-xs shadow-xl backdrop-blur ${toneClass}`}>
      {notice.message}
    </div>
  );
}
