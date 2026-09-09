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
    <header className="group flex min-h-14 shrink-0 items-center gap-3 border-b border-border/50 bg-background/80 px-4 py-2.5 backdrop-blur-md">
      <Button
        type="button"
        size="sm"
        variant={libraryOpen ? "secondary" : "ghost"}
        aria-label={libraryOpen ? t("library.collapse") : t("library.expand")}
        title={libraryOpen ? t("library.collapse") : t("library.expand")}
        aria-expanded={libraryOpen}
        aria-controls={libraryId}
        onClick={onToggleLibrary}
      >
        {libraryOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        <span className="@max-[32rem]/shimo-reader:hidden">{t("library.title")}</span>
      </Button>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate font-serif text-[15px] font-semibold tracking-tight" title={title}>{title}</h1>
          {category ? <CategoryBadge category={category} t={t} /> : null}
        </div>
        {subtitle ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
      </div>

      {active ? (
        <div className={`flex shrink-0 items-center gap-1 rounded-xl bg-muted/25 p-0.5 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 ${quiet ? "opacity-35" : "opacity-100"}`}>
          <Button
            type="button"
            size="sm"
            variant={recordsOpen ? "secondary" : "ghost"}
            aria-label={t("records.title")}
            title={recordsOpen ? t("records.collapse") : t("records.expand")}
            aria-expanded={recordsOpen}
            aria-controls={recordsId}
            onClick={onToggleRecords}
          >
            <NotebookPen />
            <span className="@max-[32rem]/shimo-reader:hidden">{t("records.title")}</span>
            <span className="rounded-md bg-background/80 px-1.5 text-[11px] tabular-nums text-muted-foreground">{recordCount}</span>
          </Button>
          <Popover open={preferencesOpen} onOpenChange={onPreferencesOpenChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant={preferencesOpen ? "secondary" : "ghost"}
                aria-label={t("preferences.title")}
                title={t("preferences.title")}
                aria-pressed={preferencesOpen}
              >
                <Settings />
              </Button>
            </PopoverTrigger>
            {preferencesPanel}
          </Popover>
        </div>
      ) : null}
    </header>
  );
}
