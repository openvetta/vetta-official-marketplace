import type { PdfAnchor, TextAnchor } from "./domain";

export function createTextAnchor(content: string, quote: string, startHint = 0): TextAnchor {
  const start = content.indexOf(quote, startHint);
  if (start < 0) throw new Error("Selected text could not be located in the source material");
  const end = start + quote.length;
  return {
    type: "text",
    start,
    end,
    quote,
    prefix: content.slice(Math.max(0, start - 32), start),
    suffix: content.slice(end, end + 32)
  };
}

export function createPdfAnchor(page: number, quote: string, rects: DOMRect[], pageRect: DOMRect): PdfAnchor {
  return {
    type: "pdf",
    page,
    quote,
    rects: rects.map((rect) => ({
      x: clamp((rect.left - pageRect.left) / pageRect.width),
      y: clamp((rect.top - pageRect.top) / pageRect.height),
      width: clamp(rect.width / pageRect.width),
      height: clamp(rect.height / pageRect.height)
    }))
  };
}

export function relocateTextAnchor(content: string, anchor: TextAnchor): TextAnchor | null {
  if (content.slice(anchor.start, anchor.end) === anchor.quote) return anchor;
  const exact = content.indexOf(anchor.quote);
  if (exact >= 0) return createTextAnchor(content, anchor.quote, exact);
  return null;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(6))));
}
