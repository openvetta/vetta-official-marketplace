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
    <article className="min-w-0 rounded-2xl border border-border/50 bg-card/90 p-4 shadow-2xs transition-all hover:border-border/80 hover:shadow-xs">
      {/* 顶部类型与位置标签 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
              isAnswer
                ? "bg-primary/10 text-primary border border-primary/20"
                : record.kind === "highlight"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                : "bg-muted text-foreground/80 border border-border/40"
            }`}
          >
            {isAnswer ? <Sparkles className="h-3 w-3" /> : null}
            {t(`records.kind.${record.kind}`)}
          </span>
          <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
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
      <blockquote className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-[13px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
          <Quote className="h-3 w-3" />
        </div>
        <span className="min-w-0 flex-1">{record.quote}</span>
      </blockquote>

      {/* 针对提问的说明 */}
      {isAnswer && question?.body ? (
        <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-[11px] font-bold text-primary">Q</span>
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
