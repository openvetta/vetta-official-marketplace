import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { LoaderCircle, Quote, Sparkles } from "lucide-react";
import type { ReactElement } from "react";
import type { ReadingRecord } from "../../domain";
import { locationLabel } from "../prompts";
import type { Locale } from "../types";
import { AnswerMarkdown } from "./AnswerMarkdown";

interface RecordCardProps {
  record: ReadingRecord;
  question?: ReadingRecord;
  locale: Locale;
  t: PluginTranslate;
  streaming?: boolean;
}

export function RecordCard({
  record,
  question,
  locale,
  t,
  streaming = false
}: RecordCardProps): ReactElement {
  const isAnswer = record.kind === "answer";

  return (
    <article className="min-w-0 rounded-xl border border-border/40 bg-background/60 p-4 shadow-2xs transition-all hover:border-border/70 hover:bg-background/90">
      {/* 顶部类型与位置标签 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-serif text-[11px] font-medium ${
              isAnswer
                ? "bg-primary/10 text-primary"
                : record.kind === "highlight"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-muted text-foreground/80"
            }`}
          >
            {isAnswer ? <Sparkles className="h-3 w-3" /> : null}
            {t(`records.kind.${record.kind}`)}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {locationLabel(record.anchor, locale)}
          </span>
        </div>

        {streaming ? (
          <span
            role="status"
            className="inline-flex items-center gap-1 font-mono text-[11px] text-primary"
          >
            <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin" />
            {t("records.generating")}
          </span>
        ) : null}
      </div>

      {/* 原文引用段落 */}
      <blockquote className="mt-2.5 flex items-start gap-2 rounded-r-lg border-l-2 border-primary/50 bg-muted/25 px-3 py-2 font-serif text-[13px] leading-relaxed text-foreground/85 [overflow-wrap:anywhere]">
        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/40" />
        <span className="min-w-0 flex-1">{record.quote}</span>
      </blockquote>

      {/* 针对提问的说明 */}
      {isAnswer && question?.body ? (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-2 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
          <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 font-mono text-[10px] font-bold text-primary">Q</span>
          <span className="min-w-0 flex-1 font-medium">{question.body}</span>
        </div>
      ) : null}

      {/* 回答正文或笔记正文 */}
      {isAnswer && (record.body || streaming) ? (
        <div className="mt-3 border-t border-border/30 pt-3 text-xs">
          <AnswerMarkdown streaming={streaming}>{record.body ?? ""}</AnswerMarkdown>
        </div>
      ) : record.body ? (
        <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">
          {record.body}
        </p>
      ) : null}

      {/* AI 模型标识 */}
      {isAnswer && record.modelKey ? (
        <div className="mt-3 flex items-center justify-end">
          <span
            className="truncate rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
            title={record.modelKey}
          >
            {record.modelKey}
          </span>
        </div>
      ) : null}
    </article>
  );
}
