import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { NotebookPen, X } from "lucide-react";
import type { ReactElement } from "react";
import type { ReadingRecord } from "../../domain";
import type { Locale } from "../types";
import { RecordList } from "./RecordList";

interface RecordsPanelProps {
  id?: string;
  records: ReadingRecord[];
  locale: Locale;
  t: PluginTranslate;
  streamingRecordId?: string | null;
  onClose(): void;
}

export function RecordsPanel({ id, records, locale, t, streamingRecordId, onClose }: RecordsPanelProps): ReactElement {
  return (
    <aside id={id} aria-label={t("records.title")} className="shimo-records-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/50 px-4 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <NotebookPen aria-hidden="true" className="size-4 text-primary" />
            {t("records.title")}
            <span className="text-xs font-normal tabular-nums text-muted-foreground">{records.length}</span>
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("records.description")}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("records.collapse")} title={t("records.collapse")} onClick={onClose}>
          <X />
        </Button>
      </header>
      <RecordList records={records} locale={locale} t={t} streamingRecordId={streamingRecordId} />
    </aside>
  );
}
