import type { ReactElement } from "react";
import type { ReaderNotice } from "../types";

export function StatusToast({ notice }: { notice: ReaderNotice }): ReactElement {
  const toneClass = notice.tone === "error"
    ? "text-destructive"
    : notice.tone === "success"
      ? "text-primary"
      : "text-foreground";

  return (
    <div
      role={notice.tone === "error" ? "alert" : "status"}
      className={`absolute right-6 bottom-6 z-40 max-w-sm rounded-2xl bg-background/95 backdrop-blur-xl px-4 py-3 text-xs font-medium leading-relaxed shadow-xl border border-border/60 animate-in fade-in slide-in-from-bottom-2 duration-200 ${toneClass}`}
    >
      {notice.message}
    </div>
  );
}
