import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { Sparkles, X } from "lucide-react";
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

export function RecordsPanel({
  id,
  records,
  locale,
  t,
  streamingRecordId,
  onClose
}: RecordsPanelProps): ReactElement {
  return (
    <aside
      id={id}
      aria-label={t("records.title")}
      className="flex min-h-0 w-full max-w-[28rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/95 shadow-sm backdrop-blur-md transition-all duration-200 @max-[58rem]/shimo-reader:max-h-[48%] @max-[58rem]/shimo-reader:max-w-none"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/40 px-5 pb-3.5 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t("records.title")}
            </h2>
            <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              {records.length}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {t("records.description")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("records.collapse")}
          title={t("records.collapse")}
          onClick={onClose}
          className="rounded-xl hover:bg-muted/70"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <RecordList
        records={records}
        locale={locale}
        t={t}
        streamingRecordId={streamingRecordId}
      />
    </aside>
  );
}
