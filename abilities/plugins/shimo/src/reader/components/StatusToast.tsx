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
      className={`absolute right-5 bottom-5 z-40 max-w-sm bg-background px-4 py-3 font-serif text-xs leading-6 shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--foreground)_40%,transparent)] ring-1 ring-border/70 ${toneClass}`}
    >
      {notice.message}
    </div>
  );
}
