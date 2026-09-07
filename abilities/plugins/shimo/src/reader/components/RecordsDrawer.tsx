import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from "@vetta/ui";
import { X } from "lucide-react";
import type { ReactElement } from "react";
import type { ReadingRecord } from "../../domain";
import type { Locale } from "../types";
import { RecordList } from "./RecordList";

interface RecordsDrawerProps {
  records: ReadingRecord[];
  locale: Locale;
  t: PluginTranslate;
  onClose(): void;
}

export function RecordsDrawer({ records, locale, t, onClose }: RecordsDrawerProps): ReactElement {
  return (
    <Drawer open direction="right" onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent
        aria-label={t("records.title")}
        className="w-[23rem] max-w-[86vw] rounded-none bg-popover/97 shadow-2xl backdrop-blur-xl sm:max-w-[23rem]"
        overlayClassName="bg-background/20"
      >
        <DrawerHeader className="flex h-16 shrink-0 flex-row items-center justify-between gap-3 border-b border-border/50 px-4 py-0">
          <div>
            <DrawerTitle className="text-sm font-semibold">{t("records.title")}</DrawerTitle>
            <DrawerDescription className="mt-0.5 text-[10px] tabular-nums">
              {t("records.count", { count: records.length })}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.close")}>
              <X />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <RecordList records={records} locale={locale} t={t} />
      </DrawerContent>
    </Drawer>
  );
}
