import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactElement } from "react";

interface PdfPaginationProps {
  page: number;
  pageCount: number;
  t: PluginTranslate;
  onPage(page: number): void;
}

export function PdfPagination({ page, pageCount, t, onPage }: PdfPaginationProps): ReactElement {
  return (
    <nav aria-label={t("pagination.label")} className="flex h-12 shrink-0 items-center justify-center gap-3 bg-background/80">
      <Button type="button" size="icon-sm" variant="ghost" disabled={page <= 1} aria-label={t("pagination.previous")} onClick={() => onPage(page - 1)}>
        <ChevronLeft />
      </Button>
      <span className="min-w-24 text-center font-serif text-xs tabular-nums tracking-wide text-muted-foreground">
        {t("pagination.progress", { page, count: pageCount || "…" })}
      </span>
      <Button type="button" size="icon-sm" variant="ghost" disabled={pageCount > 0 && page >= pageCount} aria-label={t("pagination.next")} onClick={() => onPage(page + 1)}>
        <ChevronRight />
      </Button>
    </nav>
  );
}
