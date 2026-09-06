import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import type { ReactElement } from "react";
import type { ReadingRecord } from "../../domain";
import { locationLabel } from "../prompts";
import type { Locale } from "../types";

export interface RecordListProps {
  records: ReadingRecord[];
  locale: Locale;
  t: PluginTranslate;
}

export function RecordList({ records, locale, t }: RecordListProps): ReactElement {
  if (records.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center px-6 text-center">
        <p className="max-w-48 text-xs leading-relaxed text-muted-foreground">{t("records.empty")}</p>
      </div>
    );
  }

  return (
    <div className="shimo-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      {records.slice().reverse().map((record) => (
        <RecordCard key={record.id} record={record} locale={locale} t={t} />
      ))}
    </div>
  );
}

function RecordCard({ record, locale, t }: { record: ReadingRecord; locale: Locale; t: PluginTranslate }): ReactElement {
  return (
    <article className="rounded-2xl border border-border/55 bg-card/55 p-3.5 text-[13px] text-card-foreground transition hover:border-border">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <span>{t(`records.kind.${record.kind}`)}</span>
        <span aria-hidden="true">·</span>
        <span className="normal-case tracking-normal">{locationLabel(record.anchor, locale)}</span>
      </div>
      <blockquote className="shimo-serif my-2.5 line-clamp-5 border-l-2 border-primary/30 pl-3 leading-relaxed text-foreground">
        {record.quote}
      </blockquote>
      {record.body ? (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{record.body}</p>
      ) : null}
    </article>
  );
}
