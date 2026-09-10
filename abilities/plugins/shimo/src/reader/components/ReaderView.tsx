import {
  AlignJustify,
  Bookmark,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Type
} from "lucide-react";
import { Button } from "@vetta/ui";
import { useCallback, useId, useMemo, useRef, useState, type ReactElement, type UIEvent } from "react";
import type { ShimoRuntime } from "../../runtime";
import { actionsFor, useReaderController } from "../useReaderController";
import { DocumentOutline, type HeadingItem } from "./DocumentOutline";
import { LibrarySidebar } from "./LibrarySidebar";
import { NoteComposer } from "./NoteComposer";
import { PdfPagination } from "./PdfPagination";
import { PreferencesPopover } from "./PreferencesPopover";
import { QuestionComposer } from "./QuestionComposer";
import { ReaderDropTarget } from "./ReaderDropTarget";
import { ReaderHeader } from "./ReaderHeader";
import { ReadingSurface, type ReaderFontSize, type ReaderLayoutWidth } from "./ReadingSurface";
import { RecordsPanel } from "./RecordsPanel";
import { SelectionToolbar } from "./SelectionToolbar";
import { StatusToast } from "./StatusToast";

function countWords(content: string): number {
  if (!content) return 0;
  const cjk = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = (content.replace(/[\u4e00-\u9fa5]/g, " ").match(/[a-zA-Z0-9_-]+/g) || []).length;
  return cjk + words;
}

export function ReaderView({ runtime }: { runtime: ShimoRuntime }): ReactElement {
  const reader = useReaderController(runtime);
  const libraryId = useId();
  const recordsId = useId();
  const headerControls = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 读者专属交互状态
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [fontSize, setFontSize] = useState<ReaderFontSize>("medium");
  const [layoutWidth, setLayoutWidth] = useState<ReaderLayoutWidth>("standard");
  const [scrollPercent, setScrollPercent] = useState(0);

  const closeLibrary = (): void => {
    reader.setLibraryOpen(false);
    headerControls.current?.querySelector<HTMLButtonElement>(`[aria-controls="${libraryId}"]`)?.focus();
  };

  const closeRecords = (): void => {
    reader.setRecordsOpen(false);
    headerControls.current?.querySelector<HTMLButtonElement>(`[aria-controls="${recordsId}"]`)?.focus();
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>): void => {
    reader.handleReaderScroll();
    const el = event.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((el.scrollTop / maxScroll) * 100)));
      setScrollPercent(pct);
    } else {
      setScrollPercent(0);
    }
  };

  const handleSelectHeading = useCallback((heading: HeadingItem): void => {
    if (!reader.textRoot.current) return;
    const root = reader.textRoot.current;
    const elements = Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    const target = elements.find((el) => el.textContent?.trim().includes(heading.text));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [reader.textRoot]);

  // 字数统计与预估用时
  const wordCount = useMemo(() => {
    if (!reader.manifest || reader.manifest.kind === "pdf") return 0;
    return countWords(reader.content);
  }, [reader.content, reader.manifest]);

  const estimatedMinutes = useMemo(() => {
    if (wordCount <= 0) return 1;
    return Math.max(1, Math.ceil(wordCount / 350));
  }, [wordCount]);

  const subtitle = reader.manifest ? reader.t("reader.offline") : undefined;
  const spread = reader.recordsOpen && Boolean(reader.manifest);

  const cycleFontSize = (): void => {
    setFontSize((current) => (current === "small" ? "medium" : current === "medium" ? "large" : "small"));
  };

  const cycleLayoutWidth = (): void => {
    setLayoutWidth((current) => (current === "standard" ? "wide" : current === "wide" ? "full" : "standard"));
  };

  return (
    <ReaderDropTarget onFiles={reader.importFiles}>
      {!zenMode ? (
        <LibrarySidebar
          entries={reader.entries}
          selectedId={reader.manifest?.id}
          open={reader.libraryOpen}
          id={libraryId}
          onClose={closeLibrary}
          t={reader.t}
          onSelect={reader.selectMaterial}
          onFiles={reader.importFiles}
        />
      ) : null}

      <section
        ref={headerControls}
        className="@container/shimo-reader relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background/50"
      >
        {!zenMode ? (
          <ReaderHeader
            title={reader.manifest?.title ?? reader.t("name")}
            subtitle={subtitle}
            category={reader.manifest?.category}
            recordCount={reader.records.length}
            active={Boolean(reader.manifest)}
            quiet={reader.chromeQuiet}
            libraryOpen={reader.libraryOpen}
            libraryId={libraryId}
            recordsId={recordsId}
            recordsOpen={reader.recordsOpen}
            preferencesOpen={reader.preferencesOpen}
            preferencesPanel={
              reader.manifest ? (
                <PreferencesPopover
                  preferences={reader.preferences}
                  aiModels={reader.aiModels}
                  aiModelKey={reader.aiModelKey}
                  defaultAiModelKey={reader.defaultAiModelKey}
                  aiModelsLoading={reader.aiModelsLoading}
                  aiModelsError={reader.aiModelsError}
                  canExportPdf={reader.manifest.kind === "pdf"}
                  t={reader.t}
                  onClose={() => reader.setPreferencesOpen(false)}
                  onChange={reader.changePreferences}
                  onAiModelChange={reader.changeAiModel}
                  onRefreshAiModels={reader.refreshAiModels}
                  onExport={reader.exportFormat}
                  onExportPdf={reader.exportPdf}
                />
              ) : undefined
            }
            t={reader.t}
            onToggleLibrary={() => reader.setLibraryOpen(!reader.libraryOpen)}
            onToggleRecords={() => {
              reader.setRecordsOpen(!reader.recordsOpen);
              reader.setPreferencesOpen(false);
            }}
            onPreferencesOpenChange={reader.setPreferencesOpen}
          />
        ) : null}

        {/* 顶部微光阅读进度条 */}
        {reader.manifest && !zenMode && reader.manifest.kind !== "pdf" ? (
          <div className="relative h-0.5 w-full bg-border/20" aria-label={reader.t("reader.readingProgress")}>
            <div
              className="h-full bg-primary/60 transition-all duration-150 ease-out"
              style={{ width: `${scrollPercent}%` }}
            />
          </div>
        ) : null}

        {/* 主工作区分割容器 */}
        <div
          className={`flex min-h-0 min-w-0 flex-1 overflow-hidden p-3 sm:p-5 ${
            spread ? "flex-row gap-4 @max-[58rem]/shimo-reader:flex-col @max-[58rem]/shimo-reader:gap-3" : ""
          }`}
          data-records-open={spread}
        >
          {/* 阅读纸张区 */}
          <div
            className={`relative flex min-h-0 min-w-0 flex-col ${
              spread ? "flex-1" : "mx-auto w-full flex-1"
            }`}
          >
            {/* 浮动大纲目录面板 */}
            {reader.manifest?.kind === "markdown" ? (
              <DocumentOutline
                content={reader.content}
                open={outlineOpen}
                t={reader.t}
                onClose={() => setOutlineOpen(false)}
                onSelect={handleSelectHeading}
              />
            ) : null}

            <div
              ref={scrollContainerRef}
              className="shimo-scroll min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]"
              onMouseUp={reader.captureSelection}
              onKeyUp={reader.captureSelection}
              onScroll={handleScroll}
              onPointerMove={reader.restoreChrome}
            >
              <ReadingSurface
                reader={reader}
                runtime={runtime}
                spread={spread}
                fontSize={fontSize}
                layoutWidth={layoutWidth}
              />
            </div>

            {reader.manifest?.kind === "pdf" ? (
              <PdfPagination
                page={reader.page}
                pageCount={reader.pageCount}
                t={reader.t}
                onPage={reader.setPage}
              />
            ) : null}

            {/* 底部悬浮阅读信息与快捷控制坞 (Floating Reader Dock) */}
            {reader.manifest ? (
              <aside
                aria-label="Reading controls"
                className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center transition-opacity duration-200 ${
                  reader.chromeQuiet ? "opacity-25 hover:opacity-100" : "opacity-100"
                }`}
              >
                <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
                  {/* 字数与耗时 */}
                  {wordCount > 0 ? (
                    <div className="flex items-center gap-2 border-r border-border/40 pr-2.5 text-[11px] text-muted-foreground">
                      <span>{reader.t("reader.statsWords", { count: wordCount })}</span>
                      <span aria-hidden="true" className="opacity-40">·</span>
                      <span>{reader.t("reader.statsReadTime", { minutes: estimatedMinutes })}</span>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.2 font-mono text-[10px] font-medium text-primary">
                        {scrollPercent}%
                      </span>
                    </div>
                  ) : null}

                  {/* 目录大纲切换 */}
                  {reader.manifest.kind === "markdown" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setOutlineOpen((prev) => !prev)}
                      title={outlineOpen ? reader.t("reader.tocCollapse") : reader.t("reader.tocExpand")}
                      className={`h-auto gap-1 rounded-full px-2 py-1 text-[11px] transition-colors ${
                        outlineOpen ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span className="@max-[40rem]/shimo-reader:hidden">{reader.t("reader.toc")}</span>
                    </Button>
                  ) : null}

                  {/* 字号切换 */}
                  {reader.manifest.kind !== "pdf" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={cycleFontSize}
                      title={`${reader.t("reader.fontSize")}: ${reader.t(`reader.fontSize${fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}`)}`}
                      className="h-auto gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Type className="h-3.5 w-3.5" />
                      <span className="font-serif text-[10px] font-medium">
                        {reader.locale === "zh"
                          ? fontSize === "small"
                            ? "小"
                            : fontSize === "medium"
                            ? "中"
                            : "大"
                          : fontSize.slice(0, 1).toUpperCase()}
                      </span>
                    </Button>
                  ) : null}

                  {/* 版宽循环 */}
                  {!spread && reader.manifest.kind !== "pdf" && reader.manifest.category !== "poetry" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={cycleLayoutWidth}
                      title={`${reader.t("reader.layoutWidth")}: ${reader.t(`reader.width${layoutWidth.charAt(0).toUpperCase() + layoutWidth.slice(1)}`)}`}
                      className="h-auto gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <AlignJustify className="h-3.5 w-3.5" />
                      <span className="font-serif text-[10px] font-medium">
                        {reader.locale === "zh"
                          ? layoutWidth === "standard"
                            ? "标"
                            : layoutWidth === "wide"
                            ? "宽"
                            : "全"
                          : layoutWidth.slice(0, 1).toUpperCase()}
                      </span>
                    </Button>
                  ) : null}

                  {/* 专注模式切换 */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setZenMode((prev) => !prev)}
                    title={zenMode ? reader.t("reader.zenExit") : reader.t("reader.zenEnter")}
                    className={`rounded-full p-1 transition-colors ${
                      zenMode ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {zenMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </aside>
            ) : null}
          </div>

          {/* 右侧：阅读记录面板 */}
          {spread ? (
            <RecordsPanel
              key={reader.manifest!.id}
              id={recordsId}
              records={reader.records}
              locale={reader.locale}
              t={reader.t}
              streamingRecordId={reader.streamingAnswerId}
              onClose={closeRecords}
            />
          ) : null}
        </div>

        {reader.notice ? <StatusToast notice={reader.notice} /> : null}
      </section>

      {/* 划选与交互浮层 */}
      {reader.selection && reader.manifest ? (
        <SelectionToolbar
          selection={reader.selection}
          actions={actionsFor(reader)}
          locale={reader.locale}
          t={reader.t}
          onAction={reader.runAction}
        />
      ) : null}

      {reader.pendingNote ? (
        <NoteComposer
          key={`${reader.pendingNote.kind}:${reader.pendingNote.selection.quote}`}
          pending={reader.pendingNote}
          locale={reader.locale}
          t={reader.t}
          onCancel={reader.cancelNote}
          onSave={reader.saveNote}
        />
      ) : null}

      {reader.pendingQuestion ? (
        <QuestionComposer
          key={`question:${reader.pendingQuestion.selection.quote}`}
          pending={reader.pendingQuestion}
          locale={reader.locale}
          t={reader.t}
          modelAvailable={Boolean(reader.aiModelKey)}
          onCancel={reader.cancelQuestion}
          onSubmit={reader.askQuestion}
        />
      ) : null}
    </ReaderDropTarget>
  );
}
