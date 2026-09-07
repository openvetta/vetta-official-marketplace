import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import {
  AlignLeft,
  ArrowLeftRight,
  BookOpen,
  CircleHelp,
  Highlighter,
  Image,
  Landmark,
  Languages,
  Lightbulb,
  List,
  MessageCircleQuestion,
  Scale,
  Shapes,
  Sparkles,
  TextSearch,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const ACTION_ICONS: Record<string, LucideIcon> = {
  appreciate: Sparkles,
  line: List,
  imagery: Image,
  allusion: Landmark,
  pinyin: Languages,
  explain: BookOpen,
  summary: AlignLeft,
  argument: Scale,
  term: CircleHelp,
  translate: ArrowLeftRight,
  context: TextSearch,
  character: Users,
  theme: Shapes,
  ask: MessageCircleQuestion,
  highlight: Highlighter,
  reflection: Lightbulb
};

export function SelectionToolbar({ selection, actions, locale, t, onAction }: SelectionToolbarProps): ReactElement {
  const position: CSSProperties = { left: selection.x, top: selection.y };

  return (
    <div
      role="toolbar"
      aria-label={t("selection.actions")}
      style={position}
      className="shimo-selection-menu fixed z-[9999] flex max-w-[min(28rem,calc(100vw-1.5rem))] flex-wrap items-center gap-0.5 rounded-2xl border border-border/80 bg-popover/92 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-border/30 select-none"
    >
      {actions.map((action, index) => {
        const isCommonStart = action.id === "ask";
        const isPrimaryAction = index === 0;
        const Icon = ACTION_ICONS[action.id] ?? CircleHelp;

        return (
          <span key={action.id} className="inline-flex items-center">
            {isCommonStart && (
              <span className="mx-1 h-3.5 w-px self-center bg-border/70" aria-hidden="true" />
            )}
            <Button
              type="button"
              variant={isPrimaryAction ? "secondary" : "ghost"}
              size="xs"
              onClick={() => void onAction(action)}
              className={`gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors ${
                isPrimaryAction
                  ? "bg-primary/15 text-primary font-semibold hover:bg-primary/25 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {locale === "zh" ? action.zh : action.en}
            </Button>
          </span>
        );
      })}
    </div>
  );
}
