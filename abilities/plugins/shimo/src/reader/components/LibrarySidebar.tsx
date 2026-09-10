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
    <>
      {/* 抽屉半透明遮罩背景 */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id={id}
        aria-label={t("library.title")}
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-2xl flex-col overflow-hidden border-r border-border/60 bg-background/95 shadow-2xl backdrop-blur-2xl transition-transform duration-300 ease-out sm:w-[38rem] ${
          open ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        <div className="flex h-full w-full flex-col px-5 pb-5 pt-5">
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
                className="rounded-xl hover:bg-muted/70"
              >
                <X className="h-4 w-4" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-3">
              {filteredEntries.map((entry, index) => {
                const active = selectedId === entry.id;
                const isPoetry = entry.category === "poetry";
                const isArticle = entry.category === "article";

                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => void onSelect(entry.id)}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                      active
                        ? "bg-primary/[0.06] border-primary/40 shadow-xs ring-1 ring-primary/20"
                        : "bg-card/80 border-border/60 hover:bg-muted/40 hover:border-primary/30 hover:shadow-2xs"
                    }`}
                  >
                    <div>
                      {/* 顶部标签行与序号 */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold border ${
                            isPoetry
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              : isArticle
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {getKindIcon(entry.kind)}
                          <span>{t(`category.${entry.category}`)}</span>
                        </span>

                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                          #{String(index + 1).padStart(2, "0")}
                        </span>
                      </div>

                      {/* 书目大标题 */}
                      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                        {entry.title}
                      </h3>
                    </div>

                    {/* 底部元数据与状态 */}
                    <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-2.5 text-[10px] text-muted-foreground">
                      <span className="font-mono uppercase tracking-wider text-muted-foreground/70">
                        {entry.kind}
                      </span>

                      {active ? (
                        <span className="inline-flex items-center gap-1 font-medium text-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          <span>正在阅读</span>
                        </span>
                      ) : (
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary font-medium">
                          进入阅读 →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </div>
      </aside>
    </>
  );
}
