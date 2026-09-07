import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { useState, type ReactElement } from "react";
import type { ReadingRecord, RecordKind } from "../../domain";
import { locationLabel } from "../prompts";
import type { Locale } from "../types";

export interface RecordListProps {
  records: ReadingRecord[];
  locale: Locale;
  t: PluginTranslate;
}

export function RecordList({ records, locale, t }: RecordListProps): ReactElement {
  const [kindFilter, setKindFilter] = useState<"all" | "answer" | "highlight" | "notes">("all");

  if (records.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center px-6 text-center">
        <p className="max-w-48 text-xs leading-relaxed text-muted-foreground">{t("records.empty")}</p>
      </div>
    );
  }

  const filteredRecords = records.filter((r) => {
    if (kindFilter === "all") return true;
    if (kindFilter === "answer") return r.kind === "answer";
    if (kindFilter === "highlight") return r.kind === "highlight";
    if (kindFilter === "notes") return r.kind === "note" || r.kind === "reflection";
    return true;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Quick Kind Filter (按记录类型渐进式过滤) */}
      <div className="flex items-center gap-1 border-b border-border/40 px-3 py-2 text-[11px]">
        <button
          type="button"
          onClick={() => setKindFilter("all")}
          className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
            kindFilter === "all" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          全部 ({records.length})
        </button>
        <button
          type="button"
          onClick={() => setKindFilter("answer")}
          className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
            kindFilter === "answer" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          AI 回答
        </button>
        <button
          type="button"
          onClick={() => setKindFilter("highlight")}
          className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
            kindFilter === "highlight" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          摘录
        </button>
        <button
          type="button"
          onClick={() => setKindFilter("notes")}
          className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
            kindFilter === "notes" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          手记
        </button>
      </div>

      {/* Records Scroll List */}
      <div className="shimo-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {filteredRecords.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">暂无该分类的记录</div>
        ) : (
          filteredRecords
            .slice()
            .reverse()
            .map((record) => <RecordCard key={record.id} record={record} locale={locale} t={t} />)
        )}
      </div>
    </div>
  );
}

function RecordCard({ record, locale, t }: { record: ReadingRecord; locale: Locale; t: PluginTranslate }): ReactElement {
  const isAnswer = record.kind === "answer";
  const isReflection = record.kind === "reflection" || record.kind === "note";

  return (
    <article
      className={`rounded-2xl border p-3.5 text-[13px] transition ${
        isAnswer
          ? "border-primary/25 bg-primary/5 hover:border-primary/45"
          : isReflection
          ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/35"
          : "border-border/55 bg-card/55 hover:border-border"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <span className={isAnswer ? "font-semibold text-primary" : undefined}>{t(`records.kind.${record.kind}`)}</span>
        <span aria-hidden="true">·</span>
        <span className="normal-case tracking-normal">{locationLabel(record.anchor, locale)}</span>
        {record.kind === "answer" && record.modelKey ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="normal-case tracking-normal font-mono text-[9px]">{record.modelKey}</span>
          </>
        ) : null}
      </div>
      <blockquote className="shimo-serif my-2.5 line-clamp-5 border-l-2 border-primary/40 pl-3 leading-relaxed text-foreground">
        {record.quote}
      </blockquote>
      {record.body ? (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/85 bg-background/50 rounded-lg p-2 mt-1">
          {record.body}
        </p>
      ) : null}
    </article>
  );
}
