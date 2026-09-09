import { useId, useRef, type ReactElement } from "react";
import type { ShimoRuntime } from "../../runtime";
import { actionsFor, useReaderController } from "../useReaderController";
import { LibrarySidebar } from "./LibrarySidebar";
import { NoteComposer } from "./NoteComposer";
import { PdfPagination } from "./PdfPagination";
import { PreferencesPopover } from "./PreferencesPopover";
import { QuestionComposer } from "./QuestionComposer";
import { ReaderDropTarget } from "./ReaderDropTarget";
import { ReaderHeader } from "./ReaderHeader";
import { ReadingSurface } from "./ReadingSurface";
import { RecordsPanel } from "./RecordsPanel";
import { SelectionToolbar } from "./SelectionToolbar";
import { StatusToast } from "./StatusToast";

export function ReaderView({ runtime }: { runtime: ShimoRuntime }): ReactElement {
  const reader = useReaderController(runtime);
  const libraryId = useId();
  const recordsId = useId();
  const headerControls = useRef<HTMLDivElement>(null);
  const closeLibrary = (): void => {
    reader.setLibraryOpen(false);
    headerControls.current?.querySelector<HTMLButtonElement>(`[aria-controls="${libraryId}"]`)?.focus();
  };
  const closeRecords = (): void => {
    reader.setRecordsOpen(false);
    headerControls.current?.querySelector<HTMLButtonElement>(`[aria-controls="${recordsId}"]`)?.focus();
  };
  const subtitle = reader.manifest ? reader.t("reader.offline") : undefined;

  return (
    <ReaderDropTarget onFiles={reader.importFiles}>
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

      <section ref={headerControls} className="@container/shimo-reader relative flex min-w-0 flex-1 flex-col overflow-hidden">
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
          onPreferencesOpenChange={reader.setPreferencesOpen}
        />

        <div
          className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] data-[records-open=true]:grid-cols-[minmax(0,1fr)_minmax(19rem,34%)] @max-[58rem]/shimo-reader:data-[records-open=true]:grid-cols-1 @max-[58rem]/shimo-reader:data-[records-open=true]:grid-rows-[minmax(0,1fr)_minmax(13rem,0.78fr)]"
          data-records-open={reader.recordsOpen && Boolean(reader.manifest)}
        >
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <div
              className="shimo-scroll min-h-0 flex-1 overflow-auto bg-[radial-gradient(920px_420px_at_50%_-12%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_64%)] bg-background p-4 [scrollbar-gutter:stable]"
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
          </div>
          {reader.recordsOpen && reader.manifest ? (
            <RecordsPanel
              key={reader.manifest.id}
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
