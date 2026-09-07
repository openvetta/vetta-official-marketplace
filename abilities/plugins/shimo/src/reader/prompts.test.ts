import { describe, expect, it } from "vitest";
import { ACTIONS } from "../classification";
import type { MaterialManifest } from "../domain";
import { buildQuestionPrompt, buildQuickActionPrompt, buildReadingSystemPrompt } from "./prompts";
import type { ReadingSelection } from "./types";

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
  createdAt: "2026-09-06T00:00:00.000Z",
  updatedAt: "2026-09-06T00:00:00.000Z",
  status: "active"
};

const selection: ReadingSelection = {
  quote: "明月松间照",
  anchor: { type: "text", start: 10, end: 16, quote: "明月松间照", prefix: "", suffix: "" },
  x: 20,
  y: 30
};

describe("Shimo reading AI prompts", () => {
  it("builds a self-contained quick-action prompt with a stable location", () => {
    const prompt = buildQuickActionPrompt(manifest, selection, ACTIONS.poetry[0], "zh");

    expect(prompt).toContain("资料：《山居秋暝》");
    expect(prompt).toContain("位置：位置 10");
    expect(prompt).toContain("明月松间照");
    expect(prompt).toContain("语言、节奏和情感");
  });

  it("builds a self-contained custom question for direct completion", () => {
    const prompt = buildQuestionPrompt(manifest, selection, "What does the moon image suggest?", "en");

    expect(prompt).toContain("Material: “山居秋暝”");
    expect(prompt).toContain("Passage:\n明月松间照");
    expect(prompt).toContain("Question: What does the moon image suggest?");
  });

  it("keeps poetry analysis grounded and localized in the system prompt", () => {
    const prompt = buildReadingSystemPrompt("poetry", "zh");
    expect(prompt).toContain("Analyze poetry");
    expect(prompt).toContain("never invent missing context");
    expect(prompt).toContain("使用中文回答");
  });
});
