import { Feather } from "lucide-react";
import type { ReactElement, RefObject } from "react";
import type { ReadingCategory, ReadingRecord } from "../../domain";
import { buildTextSegments } from "../textSegments";

interface TextReaderProps {
  content: string;
  pinyinRecords: ReadingRecord[];
  rootRef: RefObject<HTMLDivElement | null>;
  category?: ReadingCategory;
}

export function TextReader({ content, pinyinRecords, rootRef, category }: TextReaderProps): ReactElement {
  const segments = buildTextSegments(content, pinyinRecords);
  const poetry = category === "poetry";

  if (poetry) {
    return (
      <article
        ref={rootRef}
        data-category={category}
        className="shimo-reading-text mx-auto w-full max-w-xl text-center whitespace-pre-wrap py-6"
      >
        <div className="mb-10 flex flex-col items-center justify-center gap-2 select-none" aria-hidden="true">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 shadow-2xs">
            <Feather className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium tracking-[0.3em] text-rose-600/80 dark:text-rose-400/80">古典诗韵</span>
          <div className="h-5 w-px bg-border/60" />
        </div>

        <div className="py-2">
          {segments.map((segment, segmentIndex) => segment.type === "plain"
            ? segment.text
            : segment.tokens.map((token, tokenIndex) => (
                <ruby key={`${segment.recordId}:${segmentIndex}:${tokenIndex}`}>
                  {token.text}
                  <rt>{token.pinyin}</rt>
                </ruby>
              )))}
        </div>

        <div className="mt-14 flex items-center justify-center gap-3 text-muted-foreground/30 select-none" aria-hidden="true">
          <span className="h-px w-12 bg-border/40" />
          <span className="text-xs">❖</span>
          <span className="h-px w-12 bg-border/40" />
        </div>
      </article>
    );
  }

  return (
    <article
      ref={rootRef}
      data-category={category}
      className="shimo-reading-text mx-auto w-full max-w-3xl text-start whitespace-pre-wrap py-4"
    >
      {segments.map((segment, segmentIndex) => segment.type === "plain"
        ? segment.text
        : segment.tokens.map((token, tokenIndex) => (
            <ruby key={`${segment.recordId}:${segmentIndex}:${tokenIndex}`}>
              {token.text}
              <rt>{token.pinyin}</rt>
            </ruby>
          )))}
    </article>
  );
}
