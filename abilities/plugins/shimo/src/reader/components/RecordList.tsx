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

export function RecordList({ records, locale, t, streamingRecordId }: RecordListProps): ReactElement {
  const [kindFilter, setKindFilter] = useState<"all" | "answer" | "highlight" | "notes">("all");

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
      <div className="grid min-h-48 place-items-center px-6 text-center">
        <p className="max-w-48 text-xs leading-relaxed text-muted-foreground">{t("records.empty")}</p>
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/40 px-3 py-2 text-[11px]">
        <Button
          type="button"
          size="xs"
          variant={kindFilter === "all" ? "secondary" : "ghost"}
          aria-pressed={kindFilter === "all"}
          onClick={() => setKindFilter("all")}
          className="h-auto rounded-md px-2 py-0.5 font-medium"
        >
          {t("records.filterAll")} ({records.length})
        </Button>
        <Button
          type="button"
          size="xs"
          variant={kindFilter === "answer" ? "secondary" : "ghost"}
          aria-pressed={kindFilter === "answer"}
          onClick={() => setKindFilter("answer")}
          className="h-auto rounded-md px-2 py-0.5 font-medium"
        >
          {t("records.filterAnswers")}
        </Button>
        <Button
          type="button"
          size="xs"
          variant={kindFilter === "highlight" ? "secondary" : "ghost"}
          aria-pressed={kindFilter === "highlight"}
          onClick={() => setKindFilter("highlight")}
          className="h-auto rounded-md px-2 py-0.5 font-medium"
        >
          {t("records.filterHighlights")}
        </Button>
        <Button
          type="button"
          size="xs"
          variant={kindFilter === "notes" ? "secondary" : "ghost"}
          aria-pressed={kindFilter === "notes"}
          onClick={() => setKindFilter("notes")}
          className="h-auto rounded-md px-2 py-0.5 font-medium"
        >
          {t("records.filterNotes")}
        </Button>
      </div>

      <div ref={scrollRoot} className="shimo-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {filteredRecords.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">{t("records.filteredEmpty")}</div>
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
