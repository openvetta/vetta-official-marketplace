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
    <nav
      aria-label={t("pagination.label")}
      className="my-2 flex h-11 shrink-0 items-center justify-center gap-2"
    >
      <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background/90 px-2 py-1 shadow-sm backdrop-blur-md">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          disabled={page <= 1}
          aria-label={t("pagination.previous")}
          title={t("pagination.previous")}
          onClick={() => onPage(page - 1)}
          className="rounded-full hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-24 text-center font-serif text-xs tabular-nums tracking-wide text-foreground/80">
          {t("pagination.progress", { page, count: pageCount || "…" })}
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          disabled={pageCount > 0 && page >= pageCount}
          aria-label={t("pagination.next")}
          title={t("pagination.next")}
          onClick={() => onPage(page + 1)}
          className="rounded-full hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
