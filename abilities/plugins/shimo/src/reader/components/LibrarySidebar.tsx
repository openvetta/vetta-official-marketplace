import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button, Input } from "@vetta/ui";
import {
  BookText,
  FileCode,
  FileText,
  PanelLeftClose,
  Search,
  X
} from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
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

function getKindIcon(kind: LibraryEntry["kind"]): ReactElement {
  switch (kind) {
    case "pdf":
      return <FileText className="h-3.5 w-3.5 text-rose-500/80 shrink-0" />;
    case "markdown":
      return <FileCode className="h-3.5 w-3.5 text-sky-500/80 shrink-0" />;
    case "text":
    default:
      return <BookText className="h-3.5 w-3.5 text-amber-500/80 shrink-0" />;
  }
}

export function LibrarySidebar({
  entries,
  selectedId,
  open,
  id,
  t,
  onClose,
  onSelect,
  onFiles
}: LibrarySidebarProps): ReactElement {
  const [filter, setFilter] = useState<"all" | ReadingCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const poetryCount = useMemo(() => entries.filter((entry) => entry.category === "poetry").length, [entries]);
  const articleCount = useMemo(() => entries.filter((entry) => entry.category === "article").length, [entries]);

  const filterCount = (value: "all" | ReadingCategory): number => {
    if (value === "all") return entries.length;
    if (value === "poetry") return poetryCount;
    return articleCount;
  };

  const filteredEntries = useMemo(() => {
    const categoryMatched = filter === "all" ? entries : entries.filter((entry) => entry.category === filter);
    if (!searchQuery.trim()) return categoryMatched;
    const q = searchQuery.trim().toLowerCase();
    return categoryMatched.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        (entry.sourceName && entry.sourceName.toLowerCase().includes(q))
    );
  }, [entries, filter, searchQuery]);

  return (
    <aside
      id={id}
      aria-label={t("library.title")}
      aria-hidden={!open}
      inert={!open}
      className={`min-h-0 shrink-0 overflow-hidden border-r border-border/50 bg-background/95 backdrop-blur-md transition-all duration-200 @max-[44rem]/shimo-workspace:max-w-[48cqw] ${
        open ? "w-80" : "hidden"
      }`}
    >
      <div className="flex h-full w-full flex-col px-4 pb-4 pt-5">
        {/* 顶部品牌与控制栏 */}
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg border border-primary/20 bg-primary/10 font-serif text-lg font-bold leading-none text-primary"
              aria-hidden="true"
            >
              {t("brand.mark")}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-serif text-sm font-semibold tracking-wide text-foreground">
                {t("library.title")}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {t("records.count", { count: entries.length })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ImportButton t={t} onFiles={onFiles} />
            {onClose ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t("library.collapse")}
                title={t("library.collapse")}
                onClick={onClose}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("library.searchPlaceholder")}
            aria-label={t("library.searchPlaceholder")}
            className="h-8 pl-8 pr-7 text-xs"
          />
          {searchQuery ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => setSearchQuery("")}
              aria-label={t("library.searchClear")}
              className="absolute right-1.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>

        {/* 分类标签导航 */}
        <div className="mb-3 flex items-end gap-3 border-b border-border/40">
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
                className={`h-auto rounded-none border-b-2 px-1 pb-2 font-serif text-xs transition-colors ${
                  selected
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "all" ? t("library.filterAll") : t(`category.${value}`)} ({filterCount(value)})
              </Button>
            );
          })}
        </div>

        {/* 资料列表 */}
        <nav className="shimo-scroll min-h-0 flex-1 overflow-y-auto pr-1" aria-label={t("library.materials")}>
          {filteredEntries.length === 0 ? (
            <div className="grid min-h-44 place-items-center px-4 text-center">
              <div className="max-w-[12rem] space-y-1">
                <p className="font-serif text-xs leading-relaxed text-muted-foreground">
                  {searchQuery
                    ? t("library.noSearchResults")
                    : filter === "all"
                    ? t("library.empty")
                    : t("library.filteredEmpty")}
                </p>
                {searchQuery ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="link"
                    className="text-[11px]"
                    onClick={() => setSearchQuery("")}
                  >
                    {t("library.searchClear")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <ol className="m-0 list-none space-y-1.5 p-0">
              {filteredEntries.map((entry, index) => {
                const active = selectedId === entry.id;
                return (
                  <li key={entry.id}>
                    <Button
                      type="button"
                      size="lg"
                      variant="ghost"
                      aria-current={active ? "page" : undefined}
                      onClick={() => void onSelect(entry.id)}
                      className={`group relative h-auto w-full items-start justify-start rounded-xl p-3 text-left whitespace-normal transition-all duration-150 ${
                        active
                          ? "bg-muted/80 text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      }`}
                    >
                      {active ? (
                        <span
                          className="absolute left-0 top-3 bottom-3 w-1 rounded-r bg-primary"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="flex w-full items-start gap-2.5">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-background/80 shadow-xs border border-border/40">
                          {getKindIcon(entry.kind)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 font-serif text-[13px] font-medium leading-snug text-foreground">
                            {entry.title}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <CategoryBadge category={entry.category} t={t} />
                            <span aria-hidden="true">·</span>
                            <span className="font-mono uppercase">{entry.kind}</span>
                            <span className="ml-auto font-mono tabular-nums text-muted-foreground/60">
                              #{String(index + 1).padStart(2, "0")}
                            </span>
                          </span>
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
