import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import type { ReactElement } from "react";
import { ImportIcon } from "./icons";

const MATERIAL_ACCEPT = ".pdf,.md,.markdown,.txt,application/pdf,text/plain,text/markdown";

export interface ImportButtonProps {
  t: PluginTranslate;
  onFiles(files: FileList): Promise<void>;
  prominent?: boolean;
}

export function ImportButton({ t, onFiles, prominent = false }: ImportButtonProps): ReactElement {
  const className = prominent
    ? "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-ring/40"
    : "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground focus-within:ring-2 focus-within:ring-ring/30";

  return (
    <label className={className} title={t("library.importHint")}>
      <ImportIcon />
      {prominent ? t("library.import") : null}
      <input
        type="file"
        accept={MATERIAL_ACCEPT}
        multiple
        className="sr-only"
        aria-label={t("library.import")}
        onChange={(event) => {
          if (event.target.files) void onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </label>
  );
}
