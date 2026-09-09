import { useTranslation } from "@vetta-org/plugin-sdk";
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
    <section className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="px-5 pt-6 pb-4">
        <p className="font-serif text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          {t("records.count", { count: records.length })}
        </p>
        <h2 className="mt-1 font-serif text-xl font-medium tracking-wide">{t("records.title")}</h2>
      </header>
      <RecordList records={records} locale={localeFrom(locale)} t={t} />
    </section>
  );
}
