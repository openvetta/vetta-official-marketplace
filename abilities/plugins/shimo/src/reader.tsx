import { lazy, Suspense, useState, type DragEvent, type ReactElement } from "react";
import { EmptyLibrary } from "./reader/components/EmptyLibrary";
import { LibrarySidebar } from "./reader/components/LibrarySidebar";
import { NoteComposer } from "./reader/components/NoteComposer";
import { PdfPagination } from "./reader/components/PdfPagination";
import { PreferencesPopover } from "./reader/components/PreferencesPopover";
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
  const [dragging, setDragging] = useState(false);
  const subtitle = reader.manifest
    ? `${reader.t("reader.offline")} · ${reader.t(`category.${reader.manifest.category}`)}`
    : undefined;

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) void reader.importFiles(event.dataTransfer.files);
  };

  return (
    <main
      className="relative flex h-full min-h-[32rem] overflow-hidden bg-background text-foreground"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={handleDrop}
    >
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
          recordCount={reader.records.length}
          active={Boolean(reader.manifest)}
          quiet={reader.chromeQuiet}
          libraryOpen={reader.libraryOpen}
          recordsOpen={reader.recordsOpen}
          preferencesOpen={reader.preferencesOpen}
          t={reader.t}
          onToggleLibrary={() => reader.setLibraryOpen(!reader.libraryOpen)}
          onToggleRecords={() => {
            reader.setRecordsOpen(!reader.recordsOpen);
            reader.setPreferencesOpen(false);
          }}
          onTogglePreferences={() => {
            reader.setPreferencesOpen(!reader.preferencesOpen);
            reader.setRecordsOpen(false);
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

        {reader.preferencesOpen && reader.manifest ? (
          <PreferencesPopover
            preferences={reader.preferences}
            canExportPdf={reader.manifest.kind === "pdf"}
            t={reader.t}
            onClose={() => reader.setPreferencesOpen(false)}
            onChange={reader.changePreferences}
            onExport={reader.exportFormat}
            onExportPdf={reader.exportPdf}
          />
        ) : null}

        {reader.notice ? <StatusToast notice={reader.notice} /> : null}
      </section>

      {reader.recordsOpen && reader.manifest ? (
        <RecordsDrawer
          records={reader.records}
          locale={reader.locale}
          t={reader.t}
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

      {dragging ? (
        <div className="pointer-events-none absolute inset-3 z-50 grid place-items-center rounded-3xl border-2 border-dashed border-primary/45 bg-background/88 text-center shadow-2xl backdrop-blur-md">
          <div>
            <div className="shimo-empty-mark shimo-serif mx-auto grid size-14 place-items-center rounded-2xl text-xl">{reader.t("brand.mark")}</div>
            <p className="mt-3 text-sm font-medium">{reader.t("library.drop")}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ReadingSurface({ reader, runtime }: { reader: ReturnType<typeof useReaderController>; runtime: ShimoRuntime }): ReactElement {
  if (reader.loading && !reader.manifest) {
    return <div className="grid min-h-[30rem] place-items-center text-xs text-muted-foreground">{reader.t("status.opening")}</div>;
  }
  if (!reader.manifest) {
    return <EmptyLibrary t={reader.t} onFiles={reader.importFiles} />;
  }
  if (reader.manifest.kind === "markdown") {
    return (
      <Suspense fallback={<div className="grid min-h-[30rem] place-items-center text-xs text-muted-foreground">{reader.t("status.opening")}</div>}>
        <MarkdownReader content={reader.content} pinyinRecords={reader.pinyinRecords} rootRef={reader.textRoot} />
      </Suspense>
    );
  }
  if (reader.manifest.kind === "text") {
    return <TextReader content={reader.content} pinyinRecords={reader.pinyinRecords} rootRef={reader.textRoot} />;
  }

  return (
    <Suspense fallback={<div className="grid min-h-[30rem] place-items-center text-xs text-muted-foreground">{reader.t("status.opening")}</div>}>
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
