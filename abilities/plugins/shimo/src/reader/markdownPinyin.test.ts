import { describe, expect, it } from "vitest";
import type { ReadingRecord } from "../domain";
import { annotateTextNode } from "./markdownPinyin";

describe("Markdown pinyin projection", () => {
  it("turns an exact source-range annotation into safe ruby nodes", () => {
    const record: ReadingRecord = {
      schemaVersion: 1,
      id: "pinyin",
      materialId: "material",
      kind: "pinyin",
      quote: "明月",
      anchor: { type: "text", start: 3, end: 5, quote: "明月", prefix: "", suffix: "" },
      pinyin: [{ text: "明", pinyin: "míng" }, { text: "月", pinyin: "yuè" }],
      createdAt: "2026-09-06T00:00:00.000Z",
      updatedAt: "2026-09-06T00:00:00.000Z",
      revision: 1
    };
    const nodes = annotateTextNode({
      type: "text",
      value: "明月松间照",
      position: { start: { offset: 3 }, end: { offset: 8 } }
    }, [record]);

    expect(nodes.map((node) => node.tagName ?? node.value)).toEqual(["ruby", "ruby", "松间照"]);
    expect(nodes[0]?.children?.[1]?.tagName).toBe("rt");
  });
});
