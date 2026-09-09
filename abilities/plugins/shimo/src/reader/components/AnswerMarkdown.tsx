import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import ReactMarkdown from "react-markdown";
import type { ReactElement } from "react";

export function AnswerMarkdown({ children, streaming = false }: { children: string; streaming?: boolean }): ReactElement {
  return (
    <div className="shimo-markdown shimo-answer-markdown text-sm leading-7 text-foreground/90 [overflow-wrap:anywhere]">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          table: ({ node: _node, ...props }) => (
            <div
              className="shimo-markdown-table-wrap my-3.5 w-full overflow-x-auto rounded-xl border border-border/80 bg-background/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/70"
              tabIndex={0}
            >
              <table {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
      {streaming ? <span className="shimo-stream-caret ms-[0.12em] inline-block h-[1.05em] w-[0.45em] rounded-[0.12em] bg-primary align-[-0.16em] motion-safe:animate-shimo-caret" aria-hidden="true" /> : null}
    </div>
  );
}
