import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button, Input } from "@vetta/ui";
import {
  BookText,
  FileCode,
  FileText,
  Library,
  Search,
  X
} from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import type { LibraryEntry, ReadingCategory } from "../../domain";
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
      return <FileText className="h-4 w-4 text-rose-500/90 shrink-0" />;
    case "markdown":
      return <FileCode className="h-4 w-4 text-sky-500/90 shrink-0" />;
    case "text":
    default:
      return <BookText className="h-4 w-4 text-amber-500/90 shrink-0" />;
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
      {/* 侧栏轻量遮罩背景 */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity duration-200 animate-in fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id={id}
        aria-label={t("library.title")}
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-sm flex-col overflow-hidden border-r border-border/60 bg-background/95 shadow-2xl backdrop-blur-2xl transition-transform duration-200 ease-out sm:w-88 ${
          open ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        <div className="flex h-full w-full flex-col p-4">
          {/* 顶部标题与操作栏 */}
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Library className="h-4 w-4" />
              </div>
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {t("library.title")}
              </h2>
              <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                {entries.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <ImportButton t={t} onFiles={onFiles} />
              {onClose ? (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("library.collapse")}
                  title={t("library.collapse")}
                  onClick={onClose}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {/* 搜索框 */}
          <div className="relative mb-2.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("library.searchPlaceholder")}
              aria-label={t("library.searchPlaceholder")}
              className="h-8 rounded-lg border-border/60 bg-muted/30 pl-8 pr-8 text-xs transition-all focus:bg-background focus:ring-1 focus:ring-primary/30"
            />
            {searchQuery ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => setSearchQuery("")}
                aria-label={t("library.searchClear")}
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            ) : null}
          </div>

          {/* 分类标签导航 */}
          <div className="mb-3 flex items-center gap-1 rounded-lg bg-muted/40 p-0.5 border border-border/40">
            {FILTERS.map((value) => {
              const selected = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(value)}
                  className={`flex-1 rounded-md py-1 px-1.5 text-center text-xs font-medium transition-all ${
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
          <nav className="shimo-scroll min-h-0 flex-1 overflow-y-auto pr-0.5" aria-label={t("library.materials")}>
            {filteredEntries.length === 0 ? (
              <div className="grid min-h-44 place-items-center px-4 text-center">
                <div className="max-w-[12rem] space-y-2">
                  <p className="text-xs leading-relaxed text-muted-foreground">
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
              <div className="space-y-1.5 pb-4">
                {filteredEntries.map((entry) => {
                  const active = selectedId === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => void onSelect(entry.id)}
                      className={`group relative flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                        active
                          ? "border-primary/30 bg-primary/10 text-foreground shadow-2xs"
                          : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground"
                      }`}
                    >
                      {/* 格式图标 */}
                      <div
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors ${
                          active
                            ? "border-primary/25 bg-background text-primary shadow-2xs"
                            : "border-border/40 bg-muted/30 text-muted-foreground group-hover:border-border/60 group-hover:bg-background group-hover:text-foreground"
                        }`}
                      >
                        {getKindIcon(entry.kind)}
                      </div>

                      {/* 标题与描述信息 */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <h3
                            className={`truncate text-xs font-medium leading-snug ${
                              active
                                ? "font-semibold text-foreground"
                                : "text-foreground group-hover:text-primary transition-colors"
                            }`}
                          >
                            {entry.title}
                          </h3>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                            {entry.kind}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>{t(`category.${entry.category}`)}</span>
                          {active ? (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 font-medium text-primary">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <span>{t("library.reading")}</span>
                              </span>
                            </>
                          ) : null}
                        </div>
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
