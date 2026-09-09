import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { useEffect, useRef, useState, type ReactElement } from "react";
import type { ReadingRecord } from "../../domain";
import type { Locale } from "../types";
import { RecordCard } from "./RecordCard";

export interface RecordListProps {
  records: ReadingRecord[];
  locale: Locale;
  t: PluginTranslate;
  streamingRecordId?: string | null;
}

const FILTERS = ["all", "answer", "highlight", "notes"] as const;

export function RecordList({ records, locale, t, streamingRecordId }: RecordListProps): ReactElement {
  const [kindFilter, setKindFilter] = useState<(typeof FILTERS)[number]>("all");
  const scrollRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streamingRecordId) return;
    setKindFilter("all");
    if (scrollRoot.current) scrollRoot.current.scrollTop = 0;
  }, [streamingRecordId]);

  const questions = new Map(records.filter((record) => record.kind === "question").map((record) => [record.id, record]));
  const answeredQuestions = new Set(records.filter((record) => record.kind === "answer").map((record) => record.relatedRecordId));

  if (records.length === 0) {
    return (
      <div className="grid min-h-48 flex-1 place-items-center px-8 text-center">
        <p className="max-w-xs font-serif text-xs leading-relaxed text-muted-foreground">{t("records.empty")}</p>
      </div>
    );
  }

  const filteredRecords = records.filter((r) => {
    if (kindFilter === "all") return r.kind !== "question" || !answeredQuestions.has(r.id);
    if (kindFilter === "answer") return r.kind === "answer";
    if (kindFilter === "highlight") return r.kind === "highlight";
    if (kindFilter === "notes") return r.kind === "note" || r.kind === "reflection";
    return true;
  });

  const filterLabel = (value: (typeof FILTERS)[number]): string => {
    if (value === "all") return `${t("records.filterAll")} (${records.length})`;
    if (value === "answer") return t("records.filterAnswers");
    if (value === "highlight") return t("records.filterHighlights");
    return t("records.filterNotes");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 过滤选项卡 */}
      <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-border/40 px-5 pt-2">
        {FILTERS.map((value) => {
          const selected = kindFilter === value;
          return (
            <Button
              key={value}
              type="button"
              size="xs"
              variant="ghost"
              aria-pressed={selected}
              onClick={() => setKindFilter(value)}
              className={`h-auto rounded-none border-b-2 px-1 pb-2 font-serif text-xs transition-colors ${
                selected
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {filterLabel(value)}
            </Button>
          );
        })}
      </div>

      {/* 记录卡片流 */}
      <div ref={scrollRoot} className="shimo-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center font-serif text-xs text-muted-foreground">
            {t("records.filteredEmpty")}
          </div>
        ) : (
          filteredRecords
            .slice()
            .reverse()
            .map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                question={record.relatedRecordId ? questions.get(record.relatedRecordId) : undefined}
                locale={locale}
                t={t}
                streaming={record.id === streamingRecordId}
              />
            ))
        )}
      </div>
    </div>
  );
}
