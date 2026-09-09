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
    <header className="group grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3">
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
          className="font-serif tracking-wide"
        >
          {libraryOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          <span className="@max-[32rem]/shimo-reader:hidden">{t("library.title")}</span>
        </Button>
      </div>

      <div className="min-w-0 justify-self-center text-center">
        <h1 className="truncate font-serif text-lg font-medium tracking-wide" title={title}>{title}</h1>
        <p className="mt-0.5 flex items-center justify-center gap-2 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          {category ? <CategoryBadge category={category} t={t} /> : null}
          {category && subtitle ? <span aria-hidden="true">·</span> : null}
          {subtitle ? <span className="truncate normal-case tracking-[0.12em]">{subtitle}</span> : null}
        </p>
      </div>

      {active ? (
        <div className={`flex items-center justify-self-end gap-0.5 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 ${quiet ? "opacity-30" : "opacity-100"}`}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t("records.title")}
            title={recordsOpen ? t("records.collapse") : t("records.expand")}
            aria-expanded={recordsOpen}
            aria-controls={recordsId}
            onClick={onToggleRecords}
            className="font-serif tracking-wide"
          >
            <NotebookPen />
            <span className="@max-[32rem]/shimo-reader:hidden">{t("records.title")}</span>
            <span className="font-serif text-[12px] tabular-nums text-muted-foreground">{recordCount}</span>
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
              >
                <Settings />
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
