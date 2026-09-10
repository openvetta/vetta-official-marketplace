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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/25 text-base font-bold text-primary shadow-2xs"
              aria-hidden="true"
            >
              {t("brand.mark")}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("library.searchPlaceholder")}
            aria-label={t("library.searchPlaceholder")}
            className="h-8.5 rounded-xl border-border/60 bg-muted/40 pl-8.5 pr-8 text-xs transition-all focus:bg-background focus:ring-2 focus:ring-primary/20"
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
        <div className="mb-3.5 flex items-center rounded-xl bg-muted/60 p-1 border border-border/40 gap-1">
          {FILTERS.map((value) => {
            const selected = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(value)}
                className={`flex-1 rounded-lg py-1 px-1.5 text-center text-xs font-medium transition-all ${
                  selected
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                {value === "all" ? t("library.filterAll") : t(`category.${value}`)} ({filterCount(value)})
              </button>
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
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => void onSelect(entry.id)}
                      className={`group relative flex w-full items-start gap-2.5 rounded-xl p-3 text-left transition-all duration-150 border ${
                        active
                          ? "bg-primary/[0.06] border-primary/25 text-foreground shadow-2xs ring-1 ring-primary/10"
                          : "border-transparent text-muted-foreground hover:bg-muted/50 hover:border-border/40 hover:text-foreground"
                      }`}
                    >
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-colors ${
                        active
                          ? "bg-background border-primary/30 text-primary shadow-2xs"
                          : "bg-background/80 border-border/40 shadow-2xs"
                      }`}>
                        {getKindIcon(entry.kind)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
                          {entry.title}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <CategoryBadge category={entry.category} t={t} />
                          <span aria-hidden="true" className="opacity-30">·</span>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">{entry.kind}</span>
                          <span className="ml-auto rounded-md bg-muted/60 px-1.5 py-0.2 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                            #{String(index + 1).padStart(2, "0")}
                          </span>
                        </span>
                      </span>
                    </button>
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
