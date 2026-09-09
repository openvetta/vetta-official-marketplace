import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import ReactMarkdown from "react-markdown";
import type { ReactElement } from "react";

export function AnswerMarkdown({ children, streaming = false }: { children: string; streaming?: boolean }): ReactElement {
  return (
    <div className="shimo-markdown shimo-answer-markdown text-sm leading-7 text-foreground/90">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          table: ({ node: _node, ...props }) => (
            <div className="shimo-markdown-table-wrap" tabIndex={0}>
              <table {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
      {streaming ? <span className="shimo-stream-caret" aria-hidden="true" /> : null}
    </div>
  );
}
