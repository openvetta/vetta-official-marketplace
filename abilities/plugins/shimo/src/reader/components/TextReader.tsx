import type { ReactElement, RefObject } from "react";
import type { ReadingRecord } from "../../domain";
import { buildTextSegments } from "../textSegments";

interface TextReaderProps {
  content: string;
  pinyinRecords: ReadingRecord[];
  rootRef: RefObject<HTMLDivElement | null>;
}

export function TextReader({ content, pinyinRecords, rootRef }: TextReaderProps): ReactElement {
  const segments = buildTextSegments(content, pinyinRecords);

  return (
    <article ref={rootRef} className="shimo-reading-text mx-auto max-w-3xl whitespace-pre-wrap">
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
