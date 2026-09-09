import { Spin } from "@vetta/ui";
import { lazy, Suspense, type ReactElement } from "react";
import type { ShimoRuntime } from "../../runtime";
import type { ReaderController } from "../useReaderController";
import { EmptyLibrary } from "./EmptyLibrary";
import { TextReader } from "./TextReader";

const PdfReader = lazy(async () => ({ default: (await import("./PdfReader")).PdfReader }));
const MarkdownReader = lazy(async () => ({ default: (await import("./MarkdownReader")).MarkdownReader }));

const PARCHMENT = "mx-auto rounded-[1.15rem] border border-border/70 bg-card/80 p-[clamp(1.25rem,4cqw,3rem)] shadow-[0_1px_0_color-mix(in_oklab,var(--foreground)_4%,transparent),0_28px_56px_-36px_color-mix(in_oklab,var(--foreground)_22%,transparent)]";

export function ReadingSurface({ reader, runtime }: { reader: ReaderController; runtime: ShimoRuntime }): ReactElement {
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

  const paperWidth = reader.manifest.category === "poetry" ? "max-w-2xl" : "max-w-3xl";

  if (reader.manifest.kind === "markdown") {
    return (
      <div className={`${PARCHMENT} ${paperWidth}`}>
        <Suspense fallback={opening}>
          <MarkdownReader content={reader.content} pinyinRecords={reader.pinyinRecords} rootRef={reader.textRoot} />
        </Suspense>
      </div>
    );
  }
  if (reader.manifest.kind === "text") {
    return (
      <div className={`${PARCHMENT} ${paperWidth}`}>
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
