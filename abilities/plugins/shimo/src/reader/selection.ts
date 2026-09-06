import { createPdfAnchor, createTextAnchor } from "../anchors";
import type { MaterialManifest } from "../domain";
import type { ReadingSelection } from "./types";

const MENU_WIDTH = 380;
const MENU_HEIGHT = 96;
const EDGE_GAP = 12;

export function clampSelectionMenu(
  rect: Pick<DOMRect, "left" | "bottom">,
  viewport: { width: number; height: number }
): { x: number; y: number } {
  return {
    x: Math.max(EDGE_GAP, Math.min(rect.left, viewport.width - MENU_WIDTH - EDGE_GAP)),
    y: Math.max(EDGE_GAP, Math.min(rect.bottom + 8, viewport.height - MENU_HEIGHT - EDGE_GAP))
  };
}

export function readSelection(
  manifest: MaterialManifest,
  content: string,
  page: number,
  pdfRoot: HTMLDivElement | null,
  selection: Selection | null,
  viewport: { width: number; height: number }
): ReadingSelection | null {
  const quote = selection?.toString().trim();
  if (!selection || !quote || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  let anchor;
  try {
    anchor = manifest.kind === "pdf" && pdfRoot
      ? createPdfAnchor(page, quote, Array.from(range.getClientRects()), pdfRoot.getBoundingClientRect())
      : createTextAnchor(content, quote);
  } catch {
    return null;
  }

  return { quote, anchor, ...clampSelectionMenu(rect, viewport) };
}
