import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { BookOpen, PanelLeftClose } from "lucide-react";
import { useState, type ReactElement } from "react";
import type { LibraryEntry, ReadingCategory } from "../../domain";
import { CategoryBadge } from "./CategoryBadge";
import { ImportButton } from "./ImportButton";

interface LibrarySidebarProps {
  entries: LibraryEntry[];
  selectedId?: string;
  open: boolean;
  id?: string;
  t: PluginTranslate;
  onClose?(): void;
  onSelect(id: string): Promise<void>;
  onFiles(files: FileList): Promise<void>;
}

const FILTERS: Array<"all" | ReadingCategory> = ["all", "poetry", "article"];

export function LibrarySidebar({ entries, selectedId, open, id, t, onClose, onSelect, onFiles }: LibrarySidebarProps): ReactElement {
  const [filter, setFilter] = useState<"all" | ReadingCategory>("all");

  const poetryCount = entries.filter((entry) => entry.category === "poetry").length;
  const articleCount = entries.filter((entry) => entry.category === "article").length;
  const filteredEntries = filter === "all" ? entries : entries.filter((entry) => entry.category === filter);
  const filterCount = (value: "all" | ReadingCategory): number => {
    if (value === "all") return entries.length;
    if (value === "poetry") return poetryCount;
    return articleCount;
  };

  return (
    <aside
      id={id}
      aria-label={t("library.title")}
      aria-hidden={!open}
      inert={!open}
      className={`min-h-0 shrink-0 overflow-hidden border-r border-border/60 bg-card/40 @max-[44rem]/shimo-workspace:max-w-[45cqw] ${open ? "w-64" : "hidden"}`}
    >
      <div className="flex h-full w-full flex-col px-3 pb-3 pt-4">
        <div className="mb-4 flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-3.5" />
            </span>
            <span className="truncate font-serif text-[15px] font-semibold tracking-tight">{t("library.title")}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <ImportButton t={t} onFiles={onFiles} />
            {onClose ? (
              <Button type="button" size="icon-sm" variant="ghost" aria-label={t("library.collapse")} title={t("library.collapse")} onClick={onClose}>
                <PanelLeftClose />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-0.5 rounded-xl bg-muted/35 p-1">
          {FILTERS.map((value) => (
            <Button
              key={value}
              type="button"
              size="xs"
              variant={filter === value ? "secondary" : "ghost"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`h-auto rounded-lg px-1.5 py-1.5 text-center text-[11px] font-medium ${filter === value ? "shadow-sm" : "text-muted-foreground"}`}
            >
              {value === "all" ? t("library.filterAll") : t(`category.${value}`)} ({filterCount(value)})
            </Button>
          ))}
        </div>

        <nav className="shimo-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5" aria-label={t("library.materials")}>
          {filteredEntries.length === 0 ? (
            <div className="grid min-h-40 place-items-center px-3 text-center">
              <p className="max-w-40 text-xs leading-relaxed text-muted-foreground">
                {filter === "all" ? t("library.empty") : t("library.filteredEmpty")}
              </p>
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
                  className={`relative grid h-auto w-full justify-start gap-1.5 rounded-xl px-3 py-2.5 text-left whitespace-normal ${active ? "bg-primary/10 shadow-sm" : ""}`}
                >
                  {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                  <div className="flex min-w-0 items-center gap-2">
                    <CategoryBadge category={entry.category} t={t} glyphOnly />
                    <span className="truncate text-[13px] font-medium text-foreground">{entry.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
                    <CategoryBadge category={entry.category} t={t} />
                    <span aria-hidden="true">·</span>
                    <span className="uppercase tracking-[0.12em]">{entry.kind}</span>
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
