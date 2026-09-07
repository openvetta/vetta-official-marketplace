import type { PluginAiApi } from "@vetta-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../classification";
import type { MaterialManifest } from "../domain";
import type { ShimoRepository } from "../repository";
import { answerReadingSelection } from "./readingAiRecords";

const manifest: MaterialManifest = {
  schemaVersion: 1,
  id: "material-1",
  title: "山居秋暝",
  kind: "text",
  category: "poetry",
  sourceName: "poem.txt",
  sourceBlobId: "source-1",
  mimeType: "text/plain",
  sizeBytes: 12,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
  status: "active",
};

describe("Shimo direct reading answers", () => {
  it("saves a question, calls the selected model, then saves its answer", async () => {
    const saveRecord = vi.fn(async () => undefined);
    const repository = { saveRecord } as unknown as ShimoRepository;
    const stream = vi.fn(async (_request, options) => {
      options?.onTextDelta?.({ delta: "月光与", text: "月光与" });
      options?.onTextDelta?.({ delta: "松影", text: "月光与松影" });
      return {
      modelKey: "provider/reader",
      text: "月光与松影共同营造出清幽的空间。",
      stopReason: "stop" as const,
      usage: { inputTokens: 20, outputTokens: 12, totalTokens: 32 },
      };
    });
    const ai = { complete: vi.fn(), stream, listModels: vi.fn(), chat: vi.fn() } as unknown as PluginAiApi;
    const action = ACTIONS.poetry[0]!;
    const selection = {
      quote: "明月松间照",
      anchor: { type: "text" as const, start: 0, end: 6, quote: "明月松间照", prefix: "", suffix: "" },
      x: 10,
      y: 10,
    };
    const onQuestionSaved = vi.fn();
    const onAnswerChanged = vi.fn();

    const result = await answerReadingSelection({
      ai,
      repository,
      modelKey: "provider/reader",
      manifest,
      selection,
      action,
      question: "请赏析这句诗",
      prompt: "prompt",
      locale: "zh",
      onQuestionSaved,
      onAnswerChanged,
    });

    expect(saveRecord).toHaveBeenCalledTimes(2);
    expect(onQuestionSaved).toHaveBeenCalledWith(result.question);
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ modelKey: "provider/reader", prompt: "prompt" }),
      expect.objectContaining({ signal: undefined, onTextDelta: expect.any(Function) }),
    );
    expect(onAnswerChanged.mock.calls.map(([record]) => record.body)).toEqual([
      "",
      "月光与",
      "月光与松影",
      "月光与松影共同营造出清幽的空间。",
    ]);
    expect(result.answer).toMatchObject({
      kind: "answer",
      body: "月光与松影共同营造出清幽的空间。",
      modelKey: "provider/reader",
      relatedRecordId: result.question.id,
    });
  });

  it("keeps the saved question when model completion fails", async () => {
    const saved: unknown[] = [];
    const saveRecord = vi.fn(async (record: unknown) => { saved.push(record); });
    const repository = { saveRecord } as unknown as ShimoRepository;
    const ai = {
      complete: vi.fn(),
      stream: vi.fn(async () => { throw new Error("provider unavailable"); }),
      listModels: vi.fn(),
      chat: vi.fn(),
    } as unknown as PluginAiApi;

    await expect(answerReadingSelection({
      ai,
      repository,
      modelKey: "provider/reader",
      manifest,
      selection: {
        quote: "明月松间照",
        anchor: { type: "text", start: 0, end: 6, quote: "明月松间照", prefix: "", suffix: "" },
        x: 10,
        y: 10,
      },
      action: ACTIONS.poetry[0]!,
      question: "请赏析",
      prompt: "prompt",
      locale: "zh",
    })).rejects.toThrow("provider unavailable");

    expect(saveRecord).toHaveBeenCalledOnce();
    expect(saved[0]).toMatchObject({ kind: "question", body: "请赏析" });
  });
});
