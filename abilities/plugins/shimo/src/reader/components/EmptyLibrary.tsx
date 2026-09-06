import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import type { ReactElement } from "react";
import { ImportButton } from "./ImportButton";

export function EmptyLibrary({ t, onFiles }: { t: PluginTranslate; onFiles(files: FileList): Promise<void> }): ReactElement {
  return (
    <div className="mx-auto flex min-h-[30rem] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="shimo-empty-mark shimo-serif mb-5 grid size-16 place-items-center rounded-2xl text-2xl" aria-hidden="true">{t("brand.mark")}</div>
      <h2 className="shimo-serif text-2xl font-medium tracking-tight">{t("empty.title")}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{t("empty.description")}</p>
      <div className="mt-6">
        <ImportButton t={t} onFiles={onFiles} prominent />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/75">{t("library.importHint")}</p>
    </div>
  );
}
