import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button, Input } from "@vetta/ui";
import { Upload } from "lucide-react";
import type { ReactElement } from "react";

const MATERIAL_ACCEPT = ".pdf,.md,.markdown,.txt,application/pdf,text/plain,text/markdown";

export interface ImportButtonProps {
  t: PluginTranslate;
  onFiles(files: FileList): Promise<void>;
  prominent?: boolean;
}

export function ImportButton({ t, onFiles, prominent = false }: ImportButtonProps): ReactElement {
  return (
    <Button
      asChild
      size={prominent ? "lg" : "icon"}
      variant={prominent ? "primary" : "ghost"}
      className={prominent ? "h-10 cursor-pointer rounded-full px-5 shadow-sm" : "cursor-pointer"}
    >
      <label title={t("library.importHint")}>
        <Upload />
        {prominent ? t("library.import") : null}
        <Input
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
    </Button>
  );
}
