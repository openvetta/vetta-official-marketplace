import type { ReactElement } from "react";
import type { ReaderNotice } from "../types";

export function StatusToast({ notice }: { notice: ReaderNotice }): ReactElement {
  const toneClass = notice.tone === "error"
    ? "border-red-500/30 bg-red-950/90 text-red-50"
    : notice.tone === "success"
      ? "border-emerald-500/25 bg-emerald-950/90 text-emerald-50"
      : "border-border/65 bg-popover/95 text-popover-foreground";

  return (
    <div role={notice.tone === "error" ? "alert" : "status"} className={`absolute bottom-4 right-4 z-40 max-w-sm rounded-xl border px-3.5 py-2.5 text-xs shadow-xl backdrop-blur ${toneClass}`}>
      {notice.message}
    </div>
  );
}
