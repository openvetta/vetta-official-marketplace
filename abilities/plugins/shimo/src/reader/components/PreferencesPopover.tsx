import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from "@vetta/ui";
import { Ellipsis, X } from "lucide-react";
import type { ReactElement } from "react";
import type { ReadingAiModel } from "../../ai";
import type { ReadingPreferences } from "../../domain";
import { ReadingModelSelector } from "./ReadingModelSelector";

interface PreferencesPopoverProps {
  preferences: ReadingPreferences;
  aiModels: ReadingAiModel[];
  aiModelKey: string | null;
  defaultAiModelKey: string | null;
  aiModelsLoading: boolean;
  aiModelsError: string | null;
  canExportPdf: boolean;
  t: PluginTranslate;
  onClose(): void;
  onChange(patch: Partial<ReadingPreferences>): Promise<void>;
  onAiModelChange(modelKey: string): Promise<void>;
  onRefreshAiModels(): Promise<void>;
  onExport(format: "json" | "markdown" | "html"): Promise<void>;
  onExportPdf(): Promise<void>;
}

export function PreferencesPopover(props: PreferencesPopoverProps): ReactElement {
  const {
    preferences,
    aiModels,
    aiModelKey,
    defaultAiModelKey,
    aiModelsLoading,
    aiModelsError,
    canExportPdf,
    t,
    onClose,
    onChange,
    onAiModelChange,
    onRefreshAiModels,
    onExport,
    onExportPdf
  } = props;

  return (
    <PopoverContent
      align="end"
      sideOffset={10}
      aria-label={t("preferences.title")}
      className="w-[21rem] max-w-[calc(100vw-2rem)] gap-0 p-4 shadow-xl"
    >
      <PopoverHeader className="mb-4 flex-row items-start justify-between gap-3">
        <div>
          <PopoverTitle className="font-serif">{t("preferences.title")}</PopoverTitle>
          <PopoverDescription className="mt-0.5 text-[11px]">{t("preferences.description")}</PopoverDescription>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.close")} onClick={onClose}>
          <X />
        </Button>
      </PopoverHeader>

      <div className="space-y-3">
        <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span>{t("ai.model")}</span>
            {aiModels.length > 0 ? (
              <ReadingModelSelector
                models={aiModels}
                value={aiModelKey}
                defaultKey={defaultAiModelKey}
                t={t}
                onChange={onAiModelChange}
                onRefresh={onRefreshAiModels}
              />
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled={aiModelsLoading} onClick={() => void onRefreshAiModels()}>
                {aiModelsLoading ? t("ai.loadingModels") : t("ai.reloadModels")}
              </Button>
            )}
          </div>
          {aiModelsError ? <p className="mt-1.5 text-[10px] leading-relaxed text-destructive">{t("ai.noModels")}</p> : null}
        </div>

        <div className="flex min-h-10 items-center justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2 text-xs">
          <span>{t("preferences.pinyin")}</span>
          <Select
            value={preferences.pinyin}
            onValueChange={(value) => void onChange({ pinyin: value as ReadingPreferences["pinyin"] })}
          >
            <SelectTrigger size="sm" className="w-32" aria-label={t("preferences.pinyin")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="hidden">{t("preferences.hidden")}</SelectItem>
              <SelectItem value="on-demand">{t("preferences.onDemand")}</SelectItem>
              <SelectItem value="visible">{t("preferences.visible")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-h-10 items-center justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2 text-xs">
          <span>{t("preferences.ocr")}</span>
          <Select
            value={preferences.scannedPdfOcr}
            onValueChange={(value) => void onChange({ scannedPdfOcr: value as ReadingPreferences["scannedPdfOcr"] })}
          >
            <SelectTrigger size="sm" className="w-32" aria-label={t("preferences.ocr")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="never">{t("preferences.never")}</SelectItem>
              <SelectItem value="on-demand">{t("preferences.onDemand")}</SelectItem>
              <SelectItem value="visible-pages">{t("preferences.visiblePages")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-h-10 items-center justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2 text-xs">
          <span>{t("preferences.remember")}</span>
          <Switch
            size="sm"
            checked={preferences.rememberPosition}
            aria-label={t("preferences.remember")}
            onCheckedChange={(checked) => void onChange({ rememberPosition: checked })}
          />
        </div>
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
              <Ellipsis />
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
    </PopoverContent>
  );
}
