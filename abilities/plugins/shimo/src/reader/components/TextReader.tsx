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

  return (
    <article
      ref={rootRef}
      data-category={category}
      className={`shimo-reading-text mx-auto w-full whitespace-pre-wrap ${poetry ? "max-w-[28rem] text-center" : "max-w-2xl text-start"}`}
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
