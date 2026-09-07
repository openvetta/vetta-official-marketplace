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

export function buildQuestionPrompt(
  manifest: MaterialManifest,
  selection: ReadingSelection,
  question: string,
  locale: Locale
): string {
  const context = buildQuickActionPrompt(manifest, selection, { id: "ask", zh: "问 AI", en: "Ask AI" }, locale);
  return `${context}\n\n${locale === "zh" ? "问题" : "Question"}: ${question.trim()}`;
}

export function buildReadingSystemPrompt(category: MaterialManifest["category"], locale: Locale): string {
  const language = locale === "zh" ? "使用中文回答。" : "Answer in English.";
  const categoryGuidance = category === "poetry"
    ? "Analyze poetry from literal meaning through diction, imagery, rhythm, structure, and supported interpretations."
    : "Explain the selected passage from literal meaning through structure, key terms, assumptions, and implications.";
  return [
    "You are Shimo's focused reading assistant.",
    categoryGuidance,
    "Ground every claim in the supplied passage. Separate observation from interpretation, preserve uncertainty, and never invent missing context.",
    language,
  ].join(" ");
}
