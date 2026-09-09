import { useMemo, type ReactElement, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import type { ReadingCategory, ReadingRecord } from "../../domain";
import { createMarkdownPinyinPlugin } from "../markdownPinyin";

interface MarkdownReaderProps {
  content: string;
  pinyinRecords: ReadingRecord[];
  rootRef: RefObject<HTMLDivElement | null>;
  category?: ReadingCategory;
}

export function MarkdownReader({ content, pinyinRecords, rootRef, category }: MarkdownReaderProps): ReactElement {
  const pinyinPlugin = useMemo(() => createMarkdownPinyinPlugin(pinyinRecords), [pinyinRecords]);
  const poetry = category === "poetry";

  return (
    <article
      ref={rootRef}
      data-category={category}
      className={`shimo-reading-text shimo-markdown mx-auto w-full ${poetry ? "max-w-[28rem] text-center" : "max-w-2xl text-start"}`}
    >
      <ReactMarkdown rehypePlugins={[pinyinPlugin]} skipHtml>
        {content}
      </ReactMarkdown>
    </article>
  );
}
