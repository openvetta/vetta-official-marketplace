import { describe, expect, it } from "vitest";
import { createPdfAnchor, createTextAnchor, relocateTextAnchor } from "./anchors";

describe("Shimo stable reading anchors", () => {
  it("captures text offsets with context and relocates after small edits", () => {
    const source = "before\nA meaningful sentence\nafter";
    const anchor = createTextAnchor(source, "A meaningful sentence");
    expect(anchor.start).toBe(7);
    expect(relocateTextAnchor("before\nchanged\nA meaningful sentence\nafter", anchor)?.start).toBe(15);
  });

  it("normalizes PDF selection rectangles relative to the page", () => {
    const anchor = createPdfAnchor(2, "hello", [{ left: 20, top: 30, width: 100, height: 12, x: 20, y: 30, right: 120, bottom: 42, toJSON: () => ({}) }], { left: 20, top: 30, width: 500, height: 700, x: 20, y: 30, right: 520, bottom: 730, toJSON: () => ({}) });
    expect(anchor).toMatchObject({ type: "pdf", page: 2, quote: "hello" });
    expect(anchor.rects[0]).toEqual({ x: 0, y: 0, width: 0.2, height: 0.017143 });
  });

  it("never anchors missing selected text to the start of a document", () => {
    expect(() => createTextAnchor("正文", "不存在")).toThrow("could not be located");
  });
});
