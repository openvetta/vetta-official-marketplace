import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { X } from "lucide-react";
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
      className="flex min-h-0 w-full max-w-[30rem] shrink-0 flex-col overflow-hidden bg-background shadow-[0_28px_60px_-32px_color-mix(in_oklab,var(--foreground)_26%,transparent)] ring-1 ring-border/50 @max-[58rem]/shimo-reader:max-h-[46%] @max-[58rem]/shimo-reader:max-w-none"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6 pb-4">
        <div className="min-w-0">
          <p className="font-serif text-[11px] tracking-[0.22em] text-muted-foreground uppercase">{t("records.count", { count: records.length })}</p>
          <h2 className="mt-1 font-serif text-xl font-medium tracking-wide">{t("records.title")}</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">{t("records.description")}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("records.collapse")} title={t("records.collapse")} onClick={onClose}>
          <X />
        </Button>
      </header>
      <RecordList records={records} locale={locale} t={t} streamingRecordId={streamingRecordId} />
    </aside>
  );
}
