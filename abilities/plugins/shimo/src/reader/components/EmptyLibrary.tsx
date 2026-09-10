import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { BookOpen, Sparkles, Feather } from "lucide-react";
import type { ReactElement } from "react";
import { ImportButton } from "./ImportButton";

export function EmptyLibrary({ t, onFiles }: { t: PluginTranslate; onFiles(files: FileList): Promise<void> }): ReactElement {
  return (
    <div className="mx-auto my-auto flex w-full max-w-3xl flex-col rounded-2xl border border-border/60 bg-card/80 p-8 shadow-sm backdrop-blur-sm sm:p-12">
      {/* 顶部东方意蕴标头与墨印 */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {t("empty.title")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        </div>
        <div
          className="grid h-10 w-10 place-items-center rounded-xl border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5 text-2xl font-bold leading-none text-primary shadow-2xs"
          aria-hidden="true"
        >
          {t("brand.mark")}
        </div>
      </div>

      {/* 核心导入与快速启动卡片 */}
      <div className="my-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/30">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="mt-2">
          <ImportButton t={t} onFiles={onFiles} prominent />
        </div>
        <p className="mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
          {t("library.importHint")}
        </p>
      </div>

      {/* 阅读场景与能力矩阵 */}
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/40 bg-background/50 p-4 transition-colors hover:border-border/80">
          <div className="flex items-center gap-2 text-primary">
            <Feather className="h-4 w-4" />
            <dt className="text-xs font-semibold tracking-wide">{t("empty.poetryTitle")}</dt>
          </div>
          <dd className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("empty.poetryDescription")}</dd>
        </div>

        <div className="rounded-xl border border-border/40 bg-background/50 p-4 transition-colors hover:border-border/80">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="h-4 w-4" />
            <dt className="text-xs font-semibold tracking-wide">{t("empty.articleTitle")}</dt>
          </div>
          <dd className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("empty.articleDescription")}</dd>
        </div>
      </dl>
    </div>
  );
}
