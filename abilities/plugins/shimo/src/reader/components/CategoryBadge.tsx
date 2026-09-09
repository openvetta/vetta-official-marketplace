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
    <span className={`font-serif text-[11px] tracking-[0.18em] ${category === "poetry" ? "text-primary" : "text-muted-foreground"}`}>
      {t(`category.${category}`)}
    </span>
  );
}
