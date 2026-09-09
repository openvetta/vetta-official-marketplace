import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import type { ReactElement } from "react";
import { ImportButton } from "./ImportButton";

export function EmptyLibrary({ t, onFiles }: { t: PluginTranslate; onFiles(files: FileList): Promise<void> }): ReactElement {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[42rem] flex-col bg-background px-10 py-14 shadow-[0_28px_60px_-32px_color-mix(in_oklab,var(--foreground)_28%,transparent)] ring-1 ring-border/50 sm:px-14 sm:py-16">
      <p className="self-end font-serif text-4xl leading-none text-primary" aria-hidden="true">{t("brand.mark")}</p>

      <div className="mt-16 flex flex-1 flex-col items-center text-center">
        <h2 className="font-serif text-3xl font-medium tracking-wide text-foreground">{t("empty.title")}</h2>
        <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">{t("empty.description")}</p>
        <div className="mt-8">
          <ImportButton t={t} onFiles={onFiles} prominent />
        </div>
        <p className="mt-3 max-w-xs text-[11px] leading-5 text-muted-foreground/80">{t("library.importHint")}</p>
      </div>

      <dl className="mt-16 grid gap-5 border-t border-border/60 pt-6 text-left sm:grid-cols-2">
        <div>
          <dt className="font-serif text-[11px] tracking-[0.2em] text-primary">{t("empty.poetryTitle")}</dt>
          <dd className="mt-2 text-xs leading-6 text-muted-foreground">{t("empty.poetryDescription")}</dd>
        </div>
        <div>
          <dt className="font-serif text-[11px] tracking-[0.2em] text-muted-foreground">{t("empty.articleTitle")}</dt>
          <dd className="mt-2 text-xs leading-6 text-muted-foreground">{t("empty.articleDescription")}</dd>
        </div>
      </dl>
    </div>
  );
}
