import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { BookOpen, Feather, FileText, type LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import type { ReadingCategory } from "../../domain";

const CATEGORY_ICONS: Record<ReadingCategory, LucideIcon> = {
  poetry: Feather,
  article: FileText,
  book: BookOpen
};

const CATEGORY_TONE: Record<ReadingCategory, string> = {
  poetry: "border-primary/20 bg-primary/10 text-primary",
  article: "border-border/70 bg-muted/55 text-muted-foreground",
  book: "border-border/70 bg-accent/55 text-accent-foreground"
};

const CATEGORY_GLYPH: Record<ReadingCategory, string> = {
  poetry: "text-primary",
  article: "text-muted-foreground",
  book: "text-accent-foreground"
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
    return <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${CATEGORY_GLYPH[category]}`} />;
  }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${CATEGORY_TONE[category]}`}>
      <Icon aria-hidden="true" className="size-2.5" />
      <span>{t(`category.${category}`)}</span>
    </span>
  );
}
