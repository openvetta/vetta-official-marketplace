import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button, Popover, PopoverTrigger } from "@vetta/ui";
import { BookOpen, NotebookPen, Settings } from "lucide-react";
import type { ReactElement } from "react";

interface ReaderHeaderProps {
  title: string;
  subtitle?: string;
  recordCount: number;
  active: boolean;
  quiet: boolean;
  libraryOpen: boolean;
  recordsOpen: boolean;
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
    recordCount,
    active,
    quiet,
    libraryOpen,
    recordsOpen,
    preferencesOpen,
    preferencesPanel,
    t,
    onToggleLibrary,
    onToggleRecords,
    onPreferencesOpenChange
  } = props;

  return (
    <header className="group flex min-h-16 shrink-0 items-center gap-3 border-b border-border/45 bg-background/85 px-4 py-3 backdrop-blur-md">
      <Button
        type="button"
        size="icon-sm"
        variant={libraryOpen ? "secondary" : "ghost"}
        aria-label={libraryOpen ? t("library.collapse") : t("library.expand")}
        aria-pressed={libraryOpen}
        onClick={onToggleLibrary}
      >
        <BookOpen />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="shimo-serif truncate text-lg font-medium tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
      </div>

      {active ? (
        <div className={`flex shrink-0 items-center gap-1 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 ${quiet ? "opacity-35" : "opacity-100"}`}>
          <Button
            type="button"
            size="sm"
            variant={recordsOpen ? "secondary" : "ghost"}
            aria-pressed={recordsOpen}
            onClick={onToggleRecords}
          >
            <NotebookPen />
            {t("records.title")}
            <span className="tabular-nums text-muted-foreground">{recordCount}</span>
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
