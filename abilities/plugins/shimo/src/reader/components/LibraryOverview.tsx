import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button, Input } from "@vetta/ui";
import {
  ArrowRight,
  BookOpen,
  BookText,
  Clock,
  Feather,
  FileCode,
  FileText,
  LayoutGrid,
  List,
  MessageSquareQuote,
  Quote,
  Search,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { LibraryEntry, ReadingCategory, ReadingRecord } from "../../domain";
import type { ShimoRuntime } from "../../runtime";
import type { Locale } from "../types";
import { ImportButton } from "./ImportButton";

export interface LibraryOverviewProps {
  entries: LibraryEntry[];
  runtime: ShimoRuntime;
  t: PluginTranslate;
  locale: Locale;
  onSelect(id: string): Promise<void>;
  onFiles(files: FileList | File[]): Promise<void>;
}

const CATEGORY_FILTERS: Array<"all" | ReadingCategory> = ["all", "poetry", "article", "book"];

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

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function LibraryOverview({
  entries,
  runtime,
  t,
  locale: _locale,
  onSelect,
  onFiles
}: LibraryOverviewProps): ReactElement {
  const [filter, setFilter] = useState<"all" | ReadingCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [records, setRecords] = useState<ReadingRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    void runtime.repository.listAllRecords().then((list) => {
      if (!cancelled) setRecords(list);
    });
    return () => {
      cancelled = true;
    };
  }, [runtime]);

  const materialMap = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const filteredEntries = useMemo(() => {
    const categoryMatched = filter === "all" ? entries : entries.filter((e) => e.category === filter);
    if (!searchQuery.trim()) return categoryMatched;
    const q = searchQuery.trim().toLowerCase();
    return categoryMatched.filter(
      (e) => e.title.toLowerCase().includes(q) || (e.sourceName && e.sourceName.toLowerCase().includes(q))
    );
  }, [entries, filter, searchQuery]);

  const recentRecords = useMemo(() => records.slice(0, 6), [records]);
  const totalAnswerCount = useMemo(() => records.filter((r) => r.kind === "answer").length, [records]);

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground motion-safe:animate-shimo-in">
      {/* 统一顶栏：品牌、居中全局搜索框、统计与导入 */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-background/85 px-4 py-2.5 backdrop-blur-md sm:px-8">
        {/* 左侧：品牌与总览标头 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex items-baseline gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-foreground">
              {t("overview.title")}
            </h1>
            <span className="text-[11px] text-muted-foreground font-mono">
              ({t("overview.statMaterials", { count: entries.length })})
            </span>
          </div>
        </div>

        {/* 中间：居中显眼全局搜索框 */}
        <div className="order-last sm:order-none w-full sm:w-auto flex-1 max-w-md mx-auto">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("overview.searchPlaceholder")}
              aria-label={t("overview.searchPlaceholder")}
              className="h-8.5 w-full rounded-xl border-border/60 bg-muted/30 pl-8.5 pr-8 text-xs transition-all focus:bg-background focus:ring-2 focus:ring-primary/20"
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
        </div>

        {/* 右侧：统计徽标与导入按钮 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t("overview.statRecords", { count: records.length })}</span>
            {totalAnswerCount > 0 ? (
              <>
                <span aria-hidden="true" className="opacity-30">·</span>
                <span className="flex items-center gap-1 text-primary">
                  <Sparkles className="h-3 w-3" />
                  <span>{totalAnswerCount} 次 AI 精析</span>
                </span>
              </>
            ) : null}
          </div>
          <ImportButton t={t} onFiles={onFiles} prominent />
        </div>
      </header>

      {/* 主体内容区 */}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 space-y-8 flex-1">
        {/* 板块一：藏书全景与分类管理（All Materials Shelf） */}
        <section aria-labelledby="section-all-materials" className="space-y-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-border/30 pb-3">
            <h2 id="section-all-materials" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
              <BookText className="h-4 w-4 text-primary" />
              <span>{t("overview.allMaterials")}</span>
              <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                {filteredEntries.length}
              </span>
            </h2>

            {/* 筛选与视图切换工具栏 */}
            <div className="flex items-center justify-between sm:justify-end gap-2.5">
              {/* 分类胶囊按钮 */}
              <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5 border border-border/40">
                {CATEGORY_FILTERS.map((cat) => {
                  const count = cat === "all" ? entries.length : entries.filter((e) => e.category === cat).length;
                  const selected = filter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilter(cat)}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${
                        selected
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                      }`}
                    >
                      {cat === "all" ? t("library.filterAll") : t(`category.${cat}`)} ({count})
                    </button>
                  );
                })}
              </div>

              {/* 网格 / 列表视图切换 */}
              <div className="flex items-center rounded-lg bg-muted/40 p-0.5 border border-border/40">
                <Button
                  type="button"
                  size="icon-xs"
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  title={t("overview.viewGrid")}
                  onClick={() => setViewMode("grid")}
                  className="h-6.5 w-6.5 rounded-md"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  title={t("overview.viewList")}
                  onClick={() => setViewMode("list")}
                  className="h-6.5 w-6.5 rounded-md"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* 藏书卡片展示 */}
          {filteredEntries.length === 0 ? (
            <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? t("library.noSearchResults") : t("library.empty")}
                </p>
                {searchQuery ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="link"
                    onClick={() => setSearchQuery("")}
                    className="text-xs"
                  >
                    {t("library.searchClear")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => void onSelect(entry.id)}
                  className="group flex flex-col justify-between rounded-xl border border-border/50 bg-card/70 p-4 text-left shadow-2xs backdrop-blur-xs transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/30">
                        {entry.category === "poetry" ? <Feather className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                        <span>{t(`category.${entry.category}`)}</span>
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/60 uppercase">
                        {entry.kind}
                      </span>
                    </div>

                    <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                      {entry.title}
                    </h3>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-2.5 text-[11px] text-muted-foreground">
                    <span>{t("overview.lastRead")} {formatDate(entry.updatedAt)}</span>
                    <span className="flex items-center gap-1 font-medium text-primary opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                      <span>{t("overview.openReader")}</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/40 bg-card/60 divide-y divide-border/30 overflow-hidden">
              {filteredEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => void onSelect(entry.id)}
                  className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border/40 bg-muted/30 text-muted-foreground group-hover:text-primary">
                      {getKindIcon(entry.kind)}
                    </div>
                    <h3 className="truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                      {entry.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span className="hidden sm:inline-block rounded-md bg-muted/50 px-2 py-0.5 text-[10px]">
                      {t(`category.${entry.category}`)}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground/60 w-12 text-right">
                      {entry.kind}
                    </span>
                    <span className="text-[11px] text-muted-foreground/70 font-mono w-16 text-right">
                      {formatDate(entry.updatedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 板块二：全局研读时光流（Global Insights & Highlights Stream） */}
        {recentRecords.length > 0 ? (
          <section aria-labelledby="section-global-records" className="space-y-4 border-t border-border/40 pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 id="section-global-records" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                  <MessageSquareQuote className="h-4 w-4 text-primary" />
                  <span>{t("overview.globalRecords")}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                    {records.length}
                  </span>
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {t("overview.recordsSubtitle")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {recentRecords.map((record) => {
                const material = materialMap.get(record.materialId);
                const isAnswer = record.kind === "answer";
                return (
                  <article
                    key={record.id}
                    onClick={() => void onSelect(record.materialId)}
                    className="group flex flex-col justify-between rounded-xl border border-border/40 bg-card/70 p-3.5 shadow-2xs backdrop-blur-xs transition-all hover:border-primary/40 hover:bg-muted/20 cursor-pointer"
                  >
                    <div className="space-y-2.5">
                      {/* 归属文稿与记录体裁 */}
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate font-medium text-foreground/80 group-hover:text-primary transition-colors">
                          《{material?.title ?? "文稿"}》
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                            isAnswer
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-muted text-muted-foreground border border-border/40"
                          }`}
                        >
                          {isAnswer ? <Sparkles className="h-2.5 w-2.5" /> : null}
                          {t(`records.kind.${record.kind}`)}
                        </span>
                      </div>

                      {/* 引用文字 */}
                      <blockquote className="flex items-start gap-2 rounded-lg border-l-2 border-primary/40 bg-muted/25 px-2.5 py-1.5 text-xs italic text-muted-foreground line-clamp-2">
                        <Quote className="h-3 w-3 shrink-0 text-primary/60 mt-0.5" />
                        <span>{record.quote}</span>
                      </blockquote>

                      {/* 笔记正文或 AI 解答 */}
                      {record.body ? (
                        <p className="line-clamp-3 text-xs leading-relaxed text-foreground/90 pl-1">
                          {record.body}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2 text-[10px] text-muted-foreground/60 font-mono">
                      <span>{formatDate(record.createdAt)}</span>
                      <span className="text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        跳转正文 →
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
