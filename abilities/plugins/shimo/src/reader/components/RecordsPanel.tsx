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
    <aside
      id={id}
      aria-label={t("records.title")}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border/70 bg-card/70 @max-[58rem]/shimo-reader:border-t @max-[58rem]/shimo-reader:border-l-0"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/50 px-4 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-serif text-sm font-semibold">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <NotebookPen aria-hidden="true" className="size-3.5" />
            </span>
            {t("records.title")}
            <span className="rounded-md bg-muted/60 px-1.5 text-xs font-normal tabular-nums text-muted-foreground">{records.length}</span>
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
