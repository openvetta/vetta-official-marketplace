import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { BookOpen, Feather, FileText } from "lucide-react";
import { useState, type ReactElement } from "react";
import type { LibraryEntry, ReadingCategory } from "../../domain";
import { ImportButton } from "./ImportButton";

interface LibrarySidebarProps {
  entries: LibraryEntry[];
  selectedId?: string;
  open: boolean;
  t: PluginTranslate;
  onSelect(id: string): Promise<void>;
  onFiles(files: FileList): Promise<void>;
}

export function LibrarySidebar({ entries, selectedId, open, t, onSelect, onFiles }: LibrarySidebarProps): ReactElement {
  const [filter, setFilter] = useState<"all" | ReadingCategory>("all");

  const poetryCount = entries.filter((e) => e.category === "poetry").length;
  const articleCount = entries.filter((e) => e.category === "article").length;

  const filteredEntries = filter === "all" ? entries : entries.filter((e) => e.category === filter);

  const getCategoryIcon = (category: ReadingCategory) => {
    switch (category) {
      case "poetry":
        return <Feather className="size-3 text-amber-500/90 shrink-0" />;
      case "article":
        return <FileText className="size-3 text-sky-500/90 shrink-0" />;
      default:
        return <BookOpen className="size-3 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <aside
      aria-label={t("library.title")}
      aria-hidden={!open}
      inert={!open}
      className={`shimo-library-panel min-h-0 overflow-hidden border-r border-border/50 bg-card/35 transition-[width,opacity] duration-200 ${open ? "w-60 opacity-100" : "w-0 border-r-0 opacity-0"}`}
    >
      <div className="flex h-full w-60 flex-col px-3 pb-3 pt-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <BookOpen className="size-[18px] text-primary" />
            <span className="truncate">{t("library.title")}</span>
          </div>
          <ImportButton t={t} onFiles={onFiles} />
        </div>

        {/* Category Filter Pills (诗词与文章分类筛选) */}
        <div className="mb-3 flex items-center gap-1 rounded-xl bg-muted/20 p-1 text-[11px]">
          <Button
            type="button"
            size="xs"
            variant={filter === "all" ? "secondary" : "ghost"}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
            className="h-auto flex-1 rounded-lg py-1 text-center font-medium"
          >
            {t("library.filterAll")} ({entries.length})
          </Button>
          <Button
            type="button"
            size="xs"
            variant={filter === "poetry" ? "secondary" : "ghost"}
            aria-pressed={filter === "poetry"}
            onClick={() => setFilter("poetry")}
            className="h-auto flex-1 rounded-lg py-1 text-center font-medium"
          >
            {t("category.poetry")} ({poetryCount})
          </Button>
          <Button
            type="button"
            size="xs"
            variant={filter === "article" ? "secondary" : "ghost"}
            aria-pressed={filter === "article"}
            onClick={() => setFilter("article")}
            className="h-auto flex-1 rounded-lg py-1 text-center font-medium"
          >
            {t("category.article")} ({articleCount})
          </Button>
        </div>

        {/* Materials List */}
        <nav className="shimo-scroll min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label={t("library.materials")}>
          {filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {filter === "all" ? t("library.empty") : t("library.filteredEmpty")}
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const active = selectedId === entry.id;
              return (
                <Button
                  key={entry.id}
                  type="button"
                  size="lg"
                  variant={active ? "secondary" : "ghost"}
                  aria-current={active ? "page" : undefined}
                  onClick={() => void onSelect(entry.id)}
                  className="relative grid h-auto w-full justify-start gap-1 rounded-xl px-3 py-2.5 text-left whitespace-normal"
                >
                  {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {getCategoryIcon(entry.category)}
                    <span className="truncate text-[13px] font-medium text-foreground">{entry.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded bg-muted/40 px-1 py-0.2 font-medium">
                      {t(`category.${entry.category}`)}
                    </span>
                    <span>·</span>
                    <span className="uppercase tracking-[0.1em]">{entry.kind}</span>
                  </div>
                </Button>
              );
            })
          )}
        </nav>
      </div>
    </aside>
  );
}
