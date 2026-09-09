import { Spin } from "@vetta/ui";
import { lazy, Suspense, type ReactElement } from "react";
import type { ShimoRuntime } from "../../runtime";
import type { ReaderController } from "../useReaderController";
import { EmptyLibrary } from "./EmptyLibrary";
import { TextReader } from "./TextReader";

const PdfReader = lazy(async () => ({ default: (await import("./PdfReader")).PdfReader }));
const MarkdownReader = lazy(async () => ({ default: (await import("./MarkdownReader")).MarkdownReader }));

const SHEET = "min-h-full bg-background shadow-[0_28px_60px_-32px_color-mix(in_oklab,var(--foreground)_26%,transparent)] ring-1 ring-border/50";

export function ReadingSurface({
  reader,
  runtime,
  spread = false
}: {
  reader: ReaderController;
  runtime: ShimoRuntime;
  spread?: boolean;
}): ReactElement {
  const opening = (
    <div className={`${SHEET} grid min-h-[32rem] place-items-center text-sm text-muted-foreground`}>
      <div className="flex items-center gap-2 font-serif">
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

  const poetry = reader.manifest.category === "poetry";
  const sheetWidth = spread ? "w-full" : poetry ? "mx-auto w-full max-w-[38rem]" : "mx-auto w-full max-w-[42rem]";
  const sheetPad = poetry ? "px-12 py-16 sm:px-16 sm:py-20" : "px-10 py-12 sm:px-14 sm:py-16";

  if (reader.manifest.kind === "markdown") {
    return (
      <div className={`${SHEET} ${sheetWidth} ${sheetPad}`}>
        <Suspense fallback={opening}>
          <MarkdownReader
            content={reader.content}
            pinyinRecords={reader.pinyinRecords}
            rootRef={reader.textRoot}
            category={reader.manifest.category}
          />
        </Suspense>
      </div>
    );
  }
  if (reader.manifest.kind === "text") {
    return (
      <div className={`${SHEET} ${sheetWidth} ${sheetPad}`}>
        <TextReader
          content={reader.content}
          pinyinRecords={reader.pinyinRecords}
          rootRef={reader.textRoot}
          category={reader.manifest.category}
        />
      </div>
    );
  }

  return (
    <div className="grid min-h-full place-items-center py-4">
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
    </div>
  );
}
