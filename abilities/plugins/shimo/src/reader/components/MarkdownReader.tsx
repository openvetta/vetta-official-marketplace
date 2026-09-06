import { useMemo, type ReactElement, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import type { ReadingRecord } from "../../domain";
import { createMarkdownPinyinPlugin } from "../markdownPinyin";

interface MarkdownReaderProps {
  content: string;
  pinyinRecords: ReadingRecord[];
  rootRef: RefObject<HTMLDivElement | null>;
}

export function MarkdownReader({ content, pinyinRecords, rootRef }: MarkdownReaderProps): ReactElement {
  const pinyinPlugin = useMemo(() => createMarkdownPinyinPlugin(pinyinRecords), [pinyinRecords]);

  return (
    <article ref={rootRef} className="shimo-reading-text shimo-markdown mx-auto max-w-3xl">
      <ReactMarkdown rehypePlugins={[pinyinPlugin]} skipHtml>
        {content}
      </ReactMarkdown>
    </article>
  );
}
