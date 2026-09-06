import { describe, expect, it } from "vitest";
import type { ReadingRecord } from "../domain";
import { buildTextSegments } from "./textSegments";

function pinyinRecord(id: string, quote: string, start: number, end: number): ReadingRecord {
  return {
    schemaVersion: 1,
    id,
    materialId: "material",
    kind: "pinyin",
    quote,
    anchor: { type: "text", start, end, quote, prefix: "", suffix: "" },
    pinyin: [{ text: quote, pinyin: "test" }],
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
    revision: 1
  };
}

describe("text pinyin projection", () => {
  it("renders multiple non-overlapping annotations in source order", () => {
    const segments = buildTextSegments("一二三四五六", [
      pinyinRecord("second", "五六", 4, 6),
      pinyinRecord("first", "一二", 0, 2)
    ]);

    expect(segments.map((segment) => segment.type === "plain" ? segment.text : segment.recordId)).toEqual([
      "first",
      "三四",
      "second"
    ]);
  });

  it("ignores stale anchors instead of annotating the wrong text", () => {
    expect(buildTextSegments("正文", [pinyinRecord("stale", "旧文", 0, 2)])).toEqual([
      { type: "plain", text: "正文" }
    ]);
  });
});
