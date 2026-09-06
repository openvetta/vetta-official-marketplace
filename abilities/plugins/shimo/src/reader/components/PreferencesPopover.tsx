import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Switch
} from "@vetta/ui";
import type { ReactElement } from "react";
import type { ReadingPreferences } from "../../domain";
import { CloseIcon, MoreIcon } from "./icons";

interface PreferencesPopoverProps {
  preferences: ReadingPreferences;
  canExportPdf: boolean;
  t: PluginTranslate;
  onClose(): void;
  onChange(patch: Partial<ReadingPreferences>): Promise<void>;
  onExport(format: "json" | "markdown" | "html"): Promise<void>;
  onExportPdf(): Promise<void>;
}

const SELECT_CLASS = "h-8 rounded-lg border border-border/70 bg-background px-2 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20";

export function PreferencesPopover(props: PreferencesPopoverProps): ReactElement {
  const { preferences, canExportPdf, t, onClose, onChange, onExport, onExportPdf } = props;

  return (
    <section
      aria-label={t("preferences.title")}
      className="absolute right-4 top-[4.5rem] z-30 w-[21rem] max-w-[calc(100%-2rem)] rounded-2xl border border-border/60 bg-popover/95 p-4 text-popover-foreground shadow-2xl backdrop-blur-xl"
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{t("preferences.title")}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("preferences.description")}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.close")} onClick={onClose}>
          <CloseIcon />
        </Button>
      </header>

      <div className="space-y-3">
        <SettingRow label={t("preferences.pinyin")}>
          <select
            className={SELECT_CLASS}
            value={preferences.pinyin}
            onChange={(event) => void onChange({ pinyin: event.target.value as ReadingPreferences["pinyin"] })}
          >
            <option value="hidden">{t("preferences.hidden")}</option>
            <option value="on-demand">{t("preferences.onDemand")}</option>
            <option value="visible">{t("preferences.visible")}</option>
          </select>
        </SettingRow>

        <SettingRow label={t("preferences.ocr")}>
          <select
            className={SELECT_CLASS}
            value={preferences.scannedPdfOcr}
            onChange={(event) => void onChange({ scannedPdfOcr: event.target.value as ReadingPreferences["scannedPdfOcr"] })}
          >
            <option value="never">{t("preferences.never")}</option>
            <option value="on-demand">{t("preferences.onDemand")}</option>
            <option value="visible-pages">{t("preferences.visiblePages")}</option>
          </select>
        </SettingRow>

        <SettingRow label={t("preferences.remember") }>
          <Switch
            size="sm"
            checked={preferences.rememberPosition}
            onCheckedChange={(checked) => void onChange({ rememberPosition: checked })}
          />
        </SettingRow>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        <div>
          <p className="text-xs font-medium">{t("export.title")}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{t("export.description")}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="secondary">
              {t("export.action")}
              <MoreIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void onExport("markdown")}>Markdown</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onExport("html")}>HTML</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onExport("json")}>JSON</DropdownMenuItem>
            {canExportPdf ? (
              <DropdownMenuItem onSelect={() => void onExportPdf()}>{t("export.annotatedPdf")}</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <label className="flex min-h-10 items-center justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2 text-xs">
      <span>{label}</span>
      {children}
    </label>
  );
}
