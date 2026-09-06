import { describe, expect, it } from "vitest";
import { parsePinyinResponse } from "./pinyin";

describe("Shimo pinyin contract", () => {
  it("keeps source characters and accepts punctuation with empty pronunciation", () => {
    expect(parsePinyinResponse('[{"text":"春","pinyin":"chūn"},{"text":"，","pinyin":""}]', "春，")).toEqual([
      { text: "春", pinyin: "chūn" },
      { text: "，", pinyin: "" }
    ]);
  });

  it("rejects a model response that changes the source", () => {
    expect(() => parsePinyinResponse('[{"text":"春","pinyin":"chūn"}]', "春天")).toThrow("preserve");
  });
});
