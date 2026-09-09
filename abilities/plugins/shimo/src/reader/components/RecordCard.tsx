import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { LoaderCircle, Sparkles } from "lucide-react";
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

export function RecordCard({ record, question, locale, t, streaming = false }: RecordCardProps): ReactElement {
  const isAnswer = record.kind === "answer";

  return (
    <article className={`min-w-0 rounded-xl border p-4 text-sm ${isAnswer ? "border-primary/20 bg-background" : "border-border/50 bg-background/60"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className={`inline-flex items-center gap-1.5 font-medium ${isAnswer ? "text-primary" : ""}`}>
          {isAnswer ? <Sparkles aria-hidden="true" className="size-3" /> : null}
          {t(`records.kind.${record.kind}`)}
        </span>
        <span>{locationLabel(record.anchor, locale)}</span>
        {streaming ? (
          <span role="status" className="ml-auto inline-flex items-center gap-1 text-primary">
            <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
            {t("records.generating")}
          </span>
        ) : null}
      </div>
      <blockquote className="shimo-serif my-3 border-l-2 border-primary/30 pl-3 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
        {record.quote}
      </blockquote>
      {isAnswer && question?.body ? (
        <p className="mb-3 whitespace-pre-wrap text-sm font-medium leading-relaxed [overflow-wrap:anywhere]">{question.body}</p>
      ) : null}
      {isAnswer && (record.body || streaming) ? (
        <AnswerMarkdown streaming={streaming}>{record.body ?? ""}</AnswerMarkdown>
      ) : record.body ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">{record.body}</p>
      ) : null}
      {isAnswer && record.modelKey ? (
        <p className="mt-4 truncate border-t border-border/40 pt-2 text-[10px] text-muted-foreground" title={record.modelKey}>{record.modelKey}</p>
      ) : null}
    </article>
  );
}
