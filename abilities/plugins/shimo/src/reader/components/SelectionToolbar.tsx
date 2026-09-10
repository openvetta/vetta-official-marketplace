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

export function SelectionToolbar({ selection: _selection, actions, locale, t, onAction }: SelectionToolbarProps): ReactElement {
  return (
    <div
      role="toolbar"
      aria-label={t("selection.actions")}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-nowrap items-center gap-1 rounded-2xl border border-border/60 bg-background/95 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/[0.05] dark:ring-white/[0.08] select-none motion-safe:animate-shimo-in"
    >
      {actions.map((action, index) => {
        const isCommonStart = action.id === "ask";
        const isPrimaryAction = index === 0;
        const Icon = ACTION_ICONS[action.id] ?? CircleHelp;

        return (
          <span key={action.id} className="inline-flex items-center">
            {isCommonStart && (
              <span className="mx-1 h-4 w-px self-center bg-border" aria-hidden="true" />
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void onAction(action)}
              className={`gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                isPrimaryAction
                  ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
