import { Spin } from "@vetta/ui";
import { lazy, Suspense, type ReactElement } from "react";
import type { ShimoRuntime } from "../../runtime";
import type { ReaderController } from "../useReaderController";
import { EmptyLibrary } from "./EmptyLibrary";
import { LibraryOverview } from "./LibraryOverview";
import { TextReader } from "./TextReader";

const PdfReader = lazy(async () => ({ default: (await import("./PdfReader")).PdfReader }));
const MarkdownReader = lazy(async () => ({ default: (await import("./MarkdownReader")).MarkdownReader }));

export type ReaderFontSize = "small" | "medium" | "large";
export type ReaderLayoutWidth = "standard" | "wide" | "full";

export interface ReadingSurfaceProps {
  reader: ReaderController;
  runtime: ShimoRuntime;
  spread?: boolean;
  fontSize?: ReaderFontSize;
  layoutWidth?: ReaderLayoutWidth;
}

export function ReadingSurface({
  reader,
  runtime,
  spread = false,
  fontSize = "medium",
  layoutWidth = "standard"
}: ReadingSurfaceProps): ReactElement {
  const opening = (
    <div className="mx-auto flex min-h-[32rem] w-full max-w-2xl items-center justify-center rounded-2xl border border-border/40 bg-card/60 p-12 text-sm text-muted-foreground shadow-xs backdrop-blur-xs">
      <div className="flex items-center gap-3 font-serif">
        <Spin size="sm" />
        <span className="tracking-wider">{reader.t("status.opening")}</span>
      </div>
    </div>
  );

  if (reader.loading && !reader.manifest) {
    return opening;
  }
  if (!reader.manifest) {
    if (reader.entries.length === 0) {
      return <EmptyLibrary t={reader.t} onFiles={reader.importFiles} />;
    }
    return (
      <LibraryOverview
        entries={reader.entries}
        runtime={runtime}
        t={reader.t}
        locale={reader.locale}
        onSelect={reader.selectMaterial}
        onFiles={reader.importFiles}
      />
    );
  }

  const poetry = reader.manifest.category === "poetry";

  // 自适应版宽计算
  let widthClass = "mx-auto w-full max-w-3xl";
  if (spread) {
    widthClass = "w-full max-w-none";
  } else if (poetry) {
    widthClass = "mx-auto w-full max-w-xl";
  } else if (layoutWidth === "wide") {
    widthClass = "mx-auto w-full max-w-5xl";
  } else if (layoutWidth === "full") {
    widthClass = "w-full max-w-none";
  }

  // 内边距（底部预留空间给浮动控制坞）
  const padClass = poetry
    ? "px-8 pt-12 pb-24 sm:px-14 sm:pt-16 sm:pb-28"
    : "px-6 pt-10 pb-24 sm:px-12 sm:pt-14 sm:pb-28";

  // 字号适配
  const fontClass =
    fontSize === "small"
      ? "text-sm leading-relaxed"
      : fontSize === "large"
      ? "text-lg leading-loose"
      : "text-base leading-relaxed";

  const sheetStyle = `min-h-full transition-all ${widthClass} ${padClass} ${fontClass}`;

  if (reader.manifest.kind === "markdown") {
    return (
      <div className={sheetStyle}>
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
      <div className={sheetStyle}>
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
