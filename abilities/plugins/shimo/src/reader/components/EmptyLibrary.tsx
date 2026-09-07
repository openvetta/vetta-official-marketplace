import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Feather, FileText } from "lucide-react";
import type { ReactElement } from "react";
import { ImportButton } from "./ImportButton";

export function EmptyLibrary({ t, onFiles }: { t: PluginTranslate; onFiles(files: FileList): Promise<void> }): ReactElement {
  return (
    <div className="mx-auto flex min-h-[32rem] max-w-lg flex-col items-center justify-center px-6 py-10 text-center select-none">
      {/* Brand Icon Mark */}
      <div
        className="shimo-empty-mark shimo-serif mb-6 grid size-16 place-items-center rounded-2xl text-2xl border border-primary/20 shadow-md backdrop-blur-xs text-primary"
        aria-hidden="true"
      >
        {t("brand.mark")}
      </div>

      <h2 className="shimo-serif text-2xl font-semibold tracking-tight text-foreground">{t("empty.title")}</h2>
      <p className="mt-2.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{t("empty.description")}</p>

      {/* Primary Import Action */}
      <div className="mt-6">
        <ImportButton t={t} onFiles={onFiles} prominent />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground/70">{t("library.importHint")}</p>

      {/* Dual-Mode Learning Capabilities Preview (诗词与文章双模态导引) */}
      <div className="mt-10 grid w-full grid-cols-2 gap-3 text-left">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4 transition hover:border-border hover:bg-card/60">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500">
              <Feather className="size-3.5" />
            </span>
            <span className="text-xs font-semibold text-foreground">{t("empty.poetryTitle")}</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {t("empty.poetryDescription")}
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-4 transition hover:border-border hover:bg-card/60">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-500">
              <FileText className="size-3.5" />
            </span>
            <span className="text-xs font-semibold text-foreground">{t("empty.articleTitle")}</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {t("empty.articleDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}
