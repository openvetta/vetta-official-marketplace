import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import type { ReactElement } from "react";
import type { ReadingRecord } from "../../domain";
import type { Locale } from "../types";
import { CloseIcon } from "./icons";
import { RecordList } from "./RecordList";

interface RecordsDrawerProps {
  records: ReadingRecord[];
  locale: Locale;
  t: PluginTranslate;
  onClose(): void;
}

export function RecordsDrawer({ records, locale, t, onClose }: RecordsDrawerProps): ReactElement {
  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-20 cursor-default bg-background/20 backdrop-blur-[1px]"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <aside
        aria-label={t("records.title")}
        className="shimo-drawer-in absolute inset-y-0 right-0 z-30 flex w-[23rem] max-w-[86vw] flex-col border-l border-border/60 bg-popover/97 shadow-2xl backdrop-blur-xl"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 px-4">
          <div>
            <h2 className="text-sm font-semibold">{t("records.title")}</h2>
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
              {t("records.count", { count: records.length })}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.close")} onClick={onClose}>
            <CloseIcon />
          </Button>
        </header>
        <RecordList records={records} locale={locale} t={t} />
      </aside>
    </>
  );
}
