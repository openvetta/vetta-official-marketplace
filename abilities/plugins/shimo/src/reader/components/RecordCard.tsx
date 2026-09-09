import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { LoaderCircle } from "lucide-react";
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
    <article className="min-w-0 border-b border-border/40 py-5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] tracking-[0.14em] text-muted-foreground">
        <span className={`font-serif ${isAnswer ? "text-primary" : "text-foreground/80"}`}>
          {t(`records.kind.${record.kind}`)}
        </span>
        <span>{locationLabel(record.anchor, locale)}</span>
        {streaming ? (
          <span role="status" className="ml-auto inline-flex items-center gap-1 tracking-normal text-primary">
            <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
            {t("records.generating")}
          </span>
        ) : null}
      </div>
      <blockquote className="mt-3 font-serif text-[15px] leading-7 text-foreground/80 [overflow-wrap:anywhere]">
        {record.quote}
      </blockquote>
      {isAnswer && question?.body ? (
        <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 [overflow-wrap:anywhere]">{question.body}</p>
      ) : null}
      {isAnswer && (record.body || streaming) ? (
        <div className="mt-3">
          <AnswerMarkdown streaming={streaming}>{record.body ?? ""}</AnswerMarkdown>
        </div>
      ) : record.body ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/90 [overflow-wrap:anywhere]">{record.body}</p>
      ) : null}
      {isAnswer && record.modelKey ? (
        <p className="mt-4 truncate text-[10px] tracking-wide text-muted-foreground" title={record.modelKey}>{record.modelKey}</p>
      ) : null}
    </article>
  );
}
