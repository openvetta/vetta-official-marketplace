import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { BookOpen, Feather, FileText, type LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { ReadingCategory } from "../../domain";

const CATEGORY_ICONS: Record<ReadingCategory, LucideIcon> = {
  poetry: Feather,
  article: FileText,
  book: BookOpen
};

export function CategoryBadge({
  category,
  t,
  glyphOnly = false
}: {
  category: ReadingCategory;
  t: PluginTranslate;
  glyphOnly?: boolean;
}): ReactElement {
  const Icon = CATEGORY_ICONS[category];
  if (glyphOnly) {
    return <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
        category === "poetry"
          ? "bg-primary/10 text-primary border border-primary/20"
          : category === "article"
          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
          : "bg-muted text-muted-foreground border border-border/40"
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
      <span>{t(`category.${category}`)}</span>
    </span>
  );
}
