import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { Bookmark, Hash, X } from "lucide-react";
import { useMemo, type ReactElement } from "react";

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
}

interface DocumentOutlineProps {
  content: string;
  open: boolean;
  t: PluginTranslate;
  onClose(): void;
  onSelect(heading: HeadingItem): void;
}

export function extractHeadings(content: string): HeadingItem[] {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const headings: HeadingItem[] = [];
  let index = 0;

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim().replace(/[*_`]/g, "");
      if (text) {
        headings.push({
          id: `heading-${index++}-${text.toLowerCase().replace(/\s+/g, "-")}`,
          level,
          text
        });
      }
    }
  }
  return headings;
}

export function DocumentOutline({
  content,
  open,
  t,
  onClose,
  onSelect
}: DocumentOutlineProps): ReactElement | null {
  const headings = useMemo(() => extractHeadings(content), [content]);

  if (!open) return null;

  return (
    <div className="absolute right-4 top-4 z-20 flex w-72 flex-col rounded-xl border border-border/60 bg-background/95 p-4 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 sm:right-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-xs font-semibold tracking-wide text-foreground">
            {t("reader.toc")}
          </h3>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {headings.length}
          </span>
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={t("reader.tocCollapse")}
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="shimo-scroll mt-2 max-h-72 min-h-0 overflow-y-auto pr-1">
        {headings.length === 0 ? (
          <p className="py-6 text-center font-serif text-xs text-muted-foreground">
            {t("reader.noToc")}
          </p>
        ) : (
          <nav aria-label={t("reader.toc")}>
            <ul className="m-0 list-none space-y-1 p-0">
              {headings.map((heading) => {
                const indentClass =
                  heading.level === 1 ? "pl-2 font-medium" : heading.level === 2 ? "pl-5 text-muted-foreground" : "pl-8 text-muted-foreground/80";
                return (
                  <li key={heading.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onSelect(heading)}
                      className={`h-auto w-full justify-start gap-1.5 rounded-lg py-1.5 pr-2 text-left font-serif text-xs transition-colors hover:bg-muted/70 hover:text-foreground ${indentClass}`}
                    >
                      <Hash className="h-3 w-3 shrink-0 opacity-40" />
                      <span className="truncate">{heading.text}</span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
