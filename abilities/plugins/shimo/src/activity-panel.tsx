import { useTranslation } from "@vetta-org/plugin-sdk";
import { NotebookPen } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";
import type { ReadingRecord } from "./domain";
import { RecordList } from "./reader/components/RecordList";
import { localeFrom } from "./reader/types";
import type { ShimoRuntime } from "./runtime";

export function ActivityPanel({ runtime }: { runtime: ShimoRuntime }): ReactElement {
  const { locale, t } = useTranslation();
  const [records, setRecords] = useState<ReadingRecord[]>([]);

  useEffect(() => {
    const refresh = (id: string | null): void => {
      if (id) void runtime.repository.listRecords(id).then(setRecords);
      else setRecords([]);
    };
    refresh(runtime.getSelectedId());
    return runtime.subscribe((event) => {
      if (event.type === "material-selected" || runtime.getSelectedId() === event.materialId) {
        refresh(event.materialId);
      }
    });
  }, [runtime]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-background px-3 pb-3 pt-4 text-foreground">
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <NotebookPen aria-hidden="true" className="size-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-sm font-semibold">{t("records.title")}</h2>
          <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
            {t("records.count", { count: records.length })}
          </p>
        </div>
      </header>
      <RecordList records={records} locale={localeFrom(locale)} t={t} />
    </section>
  );
}
