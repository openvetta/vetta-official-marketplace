import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button, Popover, PopoverTrigger } from "@vetta/ui";
import { Bookmark, NotebookPen, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import type { ReactElement } from "react";
import type { ReadingCategory } from "../../domain";
import { CategoryBadge } from "./CategoryBadge";

interface ReaderHeaderProps {
  title: string;
  subtitle?: string;
  category?: ReadingCategory;
  recordCount: number;
  active: boolean;
  quiet: boolean;
  libraryOpen: boolean;
  libraryId?: string;
  recordsOpen: boolean;
  recordsId?: string;
  preferencesOpen: boolean;
  preferencesPanel?: ReactElement;
  t: PluginTranslate;
  wordCount?: number;
  estimatedMinutes?: number;
  scrollPercent?: number;
  isMarkdown?: boolean;
  outlineOpen?: boolean;
  onToggleOutline?(): void;
  onToggleLibrary(): void;
  onToggleRecords(): void;
  onPreferencesOpenChange(open: boolean): void;
}

export function ReaderHeader(props: ReaderHeaderProps): ReactElement {
  const {
    title,
    subtitle,
    category,
    recordCount,
    active,
    quiet,
    libraryOpen,
    libraryId,
    recordsOpen,
    recordsId,
    preferencesOpen,
    preferencesPanel,
    t,
    wordCount,
    estimatedMinutes,
    scrollPercent,
    isMarkdown,
    outlineOpen,
    onToggleOutline,
    onToggleLibrary,
    onToggleRecords,
    onPreferencesOpenChange
  } = props;

  return (
    <header className="group sticky top-0 z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,2.6fr)_minmax(0,1fr)] items-center gap-4 border-b border-border/40 bg-background/85 px-4 py-2.5 backdrop-blur-md transition-all duration-200">
      {/* 左侧：资料库切换 */}
      <div className="justify-self-start">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t("library.expand")}
          title={t("library.expand")}
          aria-expanded={libraryOpen}
          aria-controls={libraryId}
          onClick={onToggleLibrary}
          className={`gap-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors ${
            libraryOpen ? "hidden" : "inline-flex"
          }`}
        >
          <PanelLeftOpen className="h-4 w-4" />
          <span className="@max-[32rem]/shimo-reader:hidden">{t("library.title")}</span>
        </Button>
      </div>

      {/* 中间：文档标题与分类 */}
      <div className="min-w-0 justify-self-center text-center">
        <h1
          className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg"
          title={title}
        >
          {title}
        </h1>
        {active ? (
          <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {wordCount && wordCount > 0 ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{t("reader.statsWords", { count: wordCount })}</span>
                <span aria-hidden="true" className="opacity-30">·</span>
                <span>{t("reader.statsReadTime", { minutes: estimatedMinutes ?? 1 })}</span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-primary">
                  {scrollPercent ?? 0}%
                </span>
              </div>
            ) : null}

            {isMarkdown && onToggleOutline ? (
              <>
                {wordCount && wordCount > 0 ? <span aria-hidden="true" className="opacity-30">·</span> : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={onToggleOutline}
                  title={outlineOpen ? t("reader.tocCollapse") : t("reader.tocExpand")}
                  className={`h-auto gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                    outlineOpen
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bookmark className="h-3 w-3" />
                  <span className="@max-[40rem]/shimo-reader:hidden">{t("reader.toc")}</span>
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 右侧：阅读记录与偏好设置 */}
      {active ? (
        <div
          className={`flex items-center justify-self-end gap-1 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 ${
            quiet ? "opacity-35" : "opacity-100"
          }`}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t("records.title")}
            title={recordsOpen ? t("records.collapse") : t("records.expand")}
            aria-expanded={recordsOpen}
            aria-controls={recordsId}
            onClick={onToggleRecords}
            className={`gap-2 rounded-xl text-xs font-medium tracking-wide transition-all ${
              recordsOpen
                ? "bg-primary/15 text-primary shadow-2xs font-semibold"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <NotebookPen className="h-4 w-4" />
            <span className="@max-[32rem]/shimo-reader:hidden">{t("records.title")}</span>
            <span className={`grid h-4.5 min-w-4.5 place-items-center rounded-full px-1.5 font-mono text-[10px] font-medium transition-colors ${
              recordsOpen ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-foreground"
            }`}>
              {recordCount}
            </span>
          </Button>

          <Popover open={preferencesOpen} onOpenChange={onPreferencesOpenChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t("preferences.title")}
                title={t("preferences.title")}
                aria-pressed={preferencesOpen}
                className={`rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors ${
                  preferencesOpen ? "bg-muted/80 text-foreground" : ""
                }`}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            {preferencesPanel}
          </Popover>
        </div>
      ) : (
        <div />
      )}
    </header>
  );
}
