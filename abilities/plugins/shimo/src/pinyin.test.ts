import type { PluginAiApi } from "@vetta-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import type { ShimoRepository } from "./repository";
import { parsePinyinResponse, resolvePinyin } from "./pinyin";

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

  it("uses the model selected in Shimo", async () => {
    const complete = vi.fn(async () => ({
      modelKey: "provider/reader",
      text: '[{"text":"春","pinyin":"chūn"}]',
      stopReason: "stop" as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    }));
    const ai = { complete, listModels: vi.fn(), chat: vi.fn() } as unknown as PluginAiApi;
    const repository = {
      readPinyinCache: vi.fn(async () => null),
      writePinyinCache: vi.fn(async () => undefined),
    } as unknown as ShimoRepository;

    await resolvePinyin("春", repository, ai, "provider/reader");

    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ modelKey: "provider/reader" }));
  });
});
