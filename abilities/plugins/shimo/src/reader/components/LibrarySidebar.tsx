import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { PanelLeftClose } from "lucide-react";
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
      className={`min-h-0 shrink-0 overflow-hidden border-r border-border/40 bg-background @max-[44rem]/shimo-workspace:max-w-[48cqw] ${open ? "w-72" : "hidden"}`}
    >
      <div className="flex h-full w-full flex-col px-5 pb-5 pt-6">
        <div className="mb-6 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-serif text-2xl leading-none text-primary">{t("brand.mark")}</p>
            <p className="mt-3 font-serif text-base tracking-wide">{t("library.title")}</p>
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

        <div className="mb-5 flex items-end gap-4 border-b border-border/60">
          {FILTERS.map((value) => {
            const selected = filter === value;
            return (
              <Button
                key={value}
                type="button"
                size="xs"
                variant="ghost"
                aria-pressed={selected}
                onClick={() => setFilter(value)}
                className={`h-auto rounded-none border-b-2 px-0 pb-2 font-serif text-[13px] ${
                  selected
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "all" ? t("library.filterAll") : t(`category.${value}`)} ({filterCount(value)})
              </Button>
            );
          })}
        </div>

        <nav className="shimo-scroll min-h-0 flex-1 overflow-y-auto" aria-label={t("library.materials")}>
          {filteredEntries.length === 0 ? (
            <div className="grid min-h-40 place-items-center px-2 text-center">
              <p className="max-w-40 font-serif text-sm leading-relaxed text-muted-foreground">
                {filter === "all" ? t("library.empty") : t("library.filteredEmpty")}
              </p>
            </div>
          ) : (
            <ol className="m-0 list-none p-0">
              {filteredEntries.map((entry, index) => {
                const active = selectedId === entry.id;
                return (
                  <li key={entry.id} className="border-b border-border/40 last:border-b-0">
                    <Button
                      type="button"
                      size="lg"
                      variant="ghost"
                      aria-current={active ? "page" : undefined}
                      onClick={() => void onSelect(entry.id)}
                      className={`h-auto w-full items-start justify-start gap-3 rounded-none px-0 py-4 text-left whitespace-normal ${
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="w-7 shrink-0 pt-0.5 font-serif text-xs tabular-nums text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-serif text-[15px] leading-snug text-foreground">{entry.title}</span>
                        <span className="mt-1.5 flex items-center gap-2 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                          <CategoryBadge category={entry.category} t={t} />
                          <span aria-hidden="true">/</span>
                          <span>{entry.kind}</span>
                        </span>
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
        </nav>
      </div>
    </aside>
  );
}
