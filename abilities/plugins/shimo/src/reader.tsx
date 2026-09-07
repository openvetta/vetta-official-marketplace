import { Spin } from "@vetta/ui";
import { lazy, Suspense, type DragEvent, type ReactElement, type ReactNode, useState } from "react";
import { EmptyLibrary } from "./reader/components/EmptyLibrary";
import { LibrarySidebar } from "./reader/components/LibrarySidebar";
import { NoteComposer } from "./reader/components/NoteComposer";
import { PdfPagination } from "./reader/components/PdfPagination";
import { PreferencesPopover } from "./reader/components/PreferencesPopover";
import { QuestionComposer } from "./reader/components/QuestionComposer";
import { ReaderHeader } from "./reader/components/ReaderHeader";
import { RecordsDrawer } from "./reader/components/RecordsDrawer";
import { SelectionToolbar } from "./reader/components/SelectionToolbar";
import { StatusToast } from "./reader/components/StatusToast";
import { TextReader } from "./reader/components/TextReader";
import { actionsFor, useReaderController } from "./reader/useReaderController";
import type { ShimoRuntime } from "./runtime";

const PdfReader = lazy(async () => ({ default: (await import("./reader/components/PdfReader")).PdfReader }));
const MarkdownReader = lazy(async () => ({ default: (await import("./reader/components/MarkdownReader")).MarkdownReader }));

export function ReaderView({ runtime }: { runtime: ShimoRuntime }): ReactElement {
  const reader = useReaderController(runtime);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const subtitle = reader.manifest
    ? `${reader.t("reader.offline")} · ${reader.t(`category.${reader.manifest.category}`)}`
    : undefined;

  return (
    <ReaderDropTarget onFiles={reader.importFiles} onContainerChange={setPortalContainer}>
      <LibrarySidebar
        entries={reader.entries}
        selectedId={reader.manifest?.id}
        open={reader.libraryOpen}
        t={reader.t}
        onSelect={reader.selectMaterial}
        onFiles={reader.importFiles}
      />

      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <ReaderHeader
          title={reader.manifest?.title ?? reader.t("name")}
          subtitle={subtitle}
          category={reader.manifest?.category}
          recordCount={reader.records.length}
          active={Boolean(reader.manifest)}
          quiet={reader.chromeQuiet}
          libraryOpen={reader.libraryOpen}
          recordsOpen={reader.recordsOpen}
          preferencesOpen={reader.preferencesOpen}
          preferencesPanel={reader.manifest ? (
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
          ) : undefined}
          t={reader.t}
          onToggleLibrary={() => reader.setLibraryOpen(!reader.libraryOpen)}
          onToggleRecords={() => {
            reader.setRecordsOpen(!reader.recordsOpen);
            reader.setPreferencesOpen(false);
          }}
          onPreferencesOpenChange={(open) => {
            reader.setPreferencesOpen(open);
            if (open) reader.setRecordsOpen(false);
          }}
        />

        <div
          className="shimo-paper min-h-0 flex-1 overflow-auto px-[clamp(1.25rem,7vw,5.5rem)] py-9"
          onMouseUp={reader.captureSelection}
          onKeyUp={reader.captureSelection}
          onScroll={reader.handleReaderScroll}
          onPointerMove={reader.restoreChrome}
        >
          <ReadingSurface reader={reader} runtime={runtime} />
        </div>

        {reader.manifest?.kind === "pdf" ? (
          <PdfPagination page={reader.page} pageCount={reader.pageCount} t={reader.t} onPage={reader.setPage} />
        ) : null}

        {reader.notice ? <StatusToast notice={reader.notice} /> : null}
      </section>

      {reader.recordsOpen && reader.manifest ? (
        <RecordsDrawer
          records={reader.records}
          locale={reader.locale}
          t={reader.t}
          streamingRecordId={reader.streamingAnswerId}
          portalContainer={portalContainer}
          onClose={() => reader.setRecordsOpen(false)}
        />
      ) : null}

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

export function ReaderDropTarget({
  children,
  onFiles,
  onContainerChange,
}: {
  children: ReactNode;
  onFiles(files: FileList): Promise<void>;
  onContainerChange?(container: HTMLElement | null): void;
}): ReactElement {
  const isFileDrag = (event: DragEvent<HTMLElement>): boolean =>
    Array.from(event.dataTransfer.types).includes("Files");

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) void onFiles(event.dataTransfer.files);
  };

  return (
    <main
      ref={onContainerChange}
      className="relative flex h-full min-h-[32rem] overflow-hidden bg-background text-foreground"
      onDragOver={(event) => {
        if (isFileDrag(event)) event.preventDefault();
      }}
      onDrop={handleDrop}
    >
      {children}
    </main>
  );
}

function ReadingSurface({ reader, runtime }: { reader: ReturnType<typeof useReaderController>; runtime: ShimoRuntime }): ReactElement {
  const opening = (
    <div className="grid min-h-[30rem] place-items-center text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Spin size="sm" />
        <span>{reader.t("status.opening")}</span>
      </div>
    </div>
  );

  if (reader.loading && !reader.manifest) {
    return opening;
  }
  if (!reader.manifest) {
    return <EmptyLibrary t={reader.t} onFiles={reader.importFiles} />;
  }
  if (reader.manifest.kind === "markdown") {
    return (
      <div className="shimo-parchment mx-auto max-w-3xl p-6 sm:p-10 md:p-14">
        <Suspense fallback={opening}>
          <MarkdownReader content={reader.content} pinyinRecords={reader.pinyinRecords} rootRef={reader.textRoot} />
        </Suspense>
      </div>
    );
  }
  if (reader.manifest.kind === "text") {
    return (
      <div className="shimo-parchment mx-auto max-w-3xl p-6 sm:p-10 md:p-14">
        <TextReader content={reader.content} pinyinRecords={reader.pinyinRecords} rootRef={reader.textRoot} />
      </div>
    );
  }

  return (
    <Suspense fallback={opening}>
      <PdfReader
        runtime={runtime}
        manifest={reader.manifest}
        preferences={reader.preferences}
        url={reader.sourceUrl}
        page={reader.page}
        onPage={reader.setPage}
        onCount={reader.setPageCount}
        records={reader.pinyinRecords}
        t={reader.t}
        rootRef={reader.pdfRoot}
      />
    </Suspense>
  );
}
