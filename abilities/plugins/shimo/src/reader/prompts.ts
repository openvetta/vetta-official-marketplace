import type { PluginPromptAttachment } from "@vetta-org/plugin-sdk";
import type { SelectionAction } from "../classification";
import type { MaterialManifest, ReadingAnchor } from "../domain";
import type { Locale, ReadingSelection } from "./types";

export function locationLabel(anchor: ReadingAnchor, locale: Locale): string {
  if (anchor.type === "pdf") {
    return locale === "zh" ? `第 ${anchor.page} 页` : `Page ${anchor.page}`;
  }
  return locale === "zh" ? `位置 ${anchor.start}` : `Offset ${anchor.start}`;
}

export function buildQuickActionPrompt(
  manifest: MaterialManifest,
  selection: ReadingSelection,
  action: SelectionAction,
  locale: Locale
): string {
  const instruction = locale === "zh" ? action.promptZh : action.promptEn;
  if (locale === "zh") {
    return [
      "[拾墨阅读上下文]",
      `资料：《${manifest.title}》`,
      `类别：${manifest.category}`,
      `位置：${locationLabel(selection.anchor, locale)}`,
      "选文：",
      selection.quote,
      "",
      instruction ?? "请帮助我理解这段内容。"
    ].join("\n");
  }
  return [
    "[Shimo reading context]",
    `Material: “${manifest.title}”`,
    `Category: ${manifest.category}`,
    `Location: ${locationLabel(selection.anchor, locale)}`,
    "Passage:",
    selection.quote,
    "",
    instruction ?? "Help me understand this passage."
  ].join("\n");
}

export function buildQuestionAttachment(
  manifest: MaterialManifest,
  selection: ReadingSelection,
  locale: Locale
): PluginPromptAttachment {
  return {
    id: `shimo:${manifest.id}`,
    label: locale === "zh" ? `拾墨：${manifest.title}` : `Shimo: ${manifest.title}`,
    lifecycle: "once",
    context: {
      schema: "shimo.reading-selection",
      version: 1,
      payload: {
        materialId: manifest.id,
        title: manifest.title,
        category: manifest.category,
        quote: selection.quote,
        anchor: selection.anchor
      }
    },
    instructions: [
      locale === "zh"
        ? "回答时引用拾墨资料位置；不要臆造资料中不存在的内容。"
        : "Keep the Shimo material location in your answer and do not invent content outside the passage."
    ]
  };
}
