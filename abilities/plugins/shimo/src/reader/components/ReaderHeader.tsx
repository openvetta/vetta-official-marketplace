import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button, Popover, PopoverTrigger } from "@vetta/ui";
import { NotebookPen, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
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
          aria-label={libraryOpen ? t("library.collapse") : t("library.expand")}
          title={libraryOpen ? t("library.collapse") : t("library.expand")}
          aria-expanded={libraryOpen}
          aria-controls={libraryId}
          onClick={onToggleLibrary}
          className="gap-2 rounded-lg font-serif text-xs tracking-wide text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          {libraryOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          <span className="@max-[32rem]/shimo-reader:hidden">{t("library.title")}</span>
        </Button>
      </div>

      {/* 中间：文档标题与分类 */}
      <div className="min-w-0 justify-self-center text-center">
        <h1
          className="truncate font-serif text-base font-semibold tracking-wide text-foreground sm:text-lg"
          title={title}
        >
          {title}
        </h1>
        <div className="mt-0.5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          {category ? <CategoryBadge category={category} t={t} /> : null}
          {category && subtitle ? <span aria-hidden="true" className="opacity-50">·</span> : null}
          {subtitle ? (
            <span className="truncate tracking-wide text-muted-foreground/80">{subtitle}</span>
          ) : null}
        </div>
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
            className={`gap-2 rounded-lg font-serif text-xs tracking-wide transition-colors ${
              recordsOpen
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <NotebookPen className="h-4 w-4" />
            <span className="@max-[32rem]/shimo-reader:hidden">{t("records.title")}</span>
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-muted px-1 font-mono text-[10px] font-medium text-foreground">
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
                className={`rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground ${
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
