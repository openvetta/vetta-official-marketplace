import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Feather, FileText } from "lucide-react";
import type { ReactElement } from "react";
import { ImportButton } from "./ImportButton";

export function EmptyLibrary({ t, onFiles }: { t: PluginTranslate; onFiles(files: FileList): Promise<void> }): ReactElement {
  return (
    <div className="mx-auto flex min-h-[32rem] max-w-xl flex-col items-center justify-center px-6 py-12 text-center select-none">
      <div
        className="mb-7 grid size-[4.25rem] place-items-center rounded-2xl bg-primary/10 font-serif text-[1.65rem] text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_22%,transparent),0_18px_36px_-24px_color-mix(in_oklab,var(--primary)_50%,transparent)]"
        aria-hidden="true"
      >
        {t("brand.mark")}
      </div>

      <h2 className="font-serif text-[1.7rem] font-semibold tracking-tight text-foreground">{t("empty.title")}</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{t("empty.description")}</p>

      <div className="mt-7">
        <ImportButton t={t} onFiles={onFiles} prominent />
      </div>
      <p className="mt-2.5 text-[11px] text-muted-foreground/80">{t("library.importHint")}</p>

      <div className="mt-10 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/45 p-4 transition-colors hover:border-border hover:bg-card/70">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Feather className="size-3.5" />
            </span>
            <span className="text-sm font-semibold text-foreground">{t("empty.poetryTitle")}</span>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            {t("empty.poetryDescription")}
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/45 p-4 transition-colors hover:border-border hover:bg-card/70">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl border border-border/70 bg-muted/55 text-muted-foreground">
              <FileText className="size-3.5" />
            </span>
            <span className="text-sm font-semibold text-foreground">{t("empty.articleTitle")}</span>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            {t("empty.articleDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}
