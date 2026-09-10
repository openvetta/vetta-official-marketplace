import { describe, expect, it } from "vitest";
import { ACTIONS, inferCategory, parseAiCategory } from "./classification";

describe("Shimo classification", () => {
  it("keeps category actions predesigned and complete", () => {
    expect(ACTIONS.poetry.some((action) => action.id === "pinyin")).toBe(true);
    expect(ACTIONS.article.some((action) => action.id === "explain")).toBe(true);
    expect(ACTIONS.book.some((action) => action.id === "character")).toBe(true);
  });

  it("uses a deterministic fallback and accepts only the three AI categories", () => {
    expect(inferCategory("markdown", "唐诗三百首", "床前明月光\n疑是地上霜")).toBe("poetry");
    expect(inferCategory("pdf", "Annual report")).toBe("article");
    expect(parseAiCategory("The answer is POETRY.", "book")).toBe("poetry");
    expect(parseAiCategory("unknown", "book")).toBe("book");
  });
});
