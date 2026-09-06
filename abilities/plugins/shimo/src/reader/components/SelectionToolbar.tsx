import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import type { CSSProperties, ReactElement } from "react";
import type { SelectionAction } from "../../classification";
import type { Locale, ReadingSelection } from "../types";

interface SelectionToolbarProps {
  selection: ReadingSelection;
  actions: SelectionAction[];
  locale: Locale;
  t: PluginTranslate;
  onAction(action: SelectionAction): Promise<void>;
}

export function SelectionToolbar({ selection, actions, locale, t, onAction }: SelectionToolbarProps): ReactElement {
  const position: CSSProperties = { left: selection.x, top: selection.y };

  return (
    <div
      role="toolbar"
      aria-label={t("selection.actions")}
      style={position}
      className="shimo-selection-menu fixed z-[9999] flex max-w-[min(26rem,calc(100vw-1.5rem))] flex-wrap gap-0.5 rounded-2xl border border-border/65 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-md"
    >
      {actions.map((action) => (
        <Button key={action.id} type="button" variant="ghost" size="xs" onClick={() => void onAction(action)}>
          {locale === "zh" ? action.zh : action.en}
        </Button>
      ))}
    </div>
  );
}
