import type { PluginAiApi } from "@vetta-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { completeReading, resolveReadingModelKey, toReadingAiModels } from "./ai";

const listed = {
  defaultModel: "provider/default",
  models: [
    {
      modelKey: "provider/default",
      provider: "provider",
      id: "default",
      name: "Default",
      api: "openai-responses",
      reasoning: false,
      input: ["text"] as Array<"text" | "image">,
      contextWindow: 128_000,
    },
    {
      modelKey: "provider/selected",
      provider: "provider",
      id: "selected",
      name: "Selected",
      api: "openai-responses",
      reasoning: true,
      input: ["text"] as Array<"text" | "image">,
      contextWindow: 128_000,
    },
  ],
};

describe("Shimo AI model selection", () => {
  it("keeps a saved available model ahead of the host default", () => {
    const models = toReadingAiModels(listed);
    expect(models.map((model) => model.supportsImage)).toEqual([false, false]);
    expect(resolveReadingModelKey({ schemaVersion: 1, modelKey: "provider/selected" }, models, listed.defaultModel))
      .toBe("provider/selected");
  });

  it("uses the host default once for an unavailable or missing saved choice", () => {
    const models = toReadingAiModels(listed);
    expect(resolveReadingModelKey({ schemaVersion: 1, modelKey: "provider/removed" }, models, listed.defaultModel))
      .toBe("provider/default");
    expect(resolveReadingModelKey({ schemaVersion: 1 }, models, null)).toBe("provider/default");
  });

  it("always sends the Shimo-selected model key to completion", async () => {
    const stream = vi.fn(async () => ({
      modelKey: "provider/selected",
      text: "answer",
      stopReason: "stop" as const,
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    }));
    const ai: PluginAiApi = {
      listModels: vi.fn(async () => listed),
      complete: vi.fn(),
      stream,
      chat: vi.fn(),
    };

    await completeReading(ai, "provider/selected", "system", "prompt");

    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ modelKey: "provider/selected" }),
      undefined,
    );
  });

  it("fails before calling the host when no reading model is selected", async () => {
    const stream = vi.fn();
    const ai = { listModels: vi.fn(), complete: vi.fn(), stream, chat: vi.fn() } as unknown as PluginAiApi;
    await expect(completeReading(ai, null, "system", "prompt")).rejects.toThrow("No Shimo AI model");
    expect(stream).not.toHaveBeenCalled();
  });
});
