import type { DocumentKind, ReadingCategory } from "./domain";

export interface SelectionAction {
  id: string;
  zh: string;
  en: string;
  promptZh?: string;
  promptEn?: string;
  local?: "highlight" | "note" | "reflection" | "pinyin";
}

const COMMON: SelectionAction[] = [
  { id: "ask", zh: "问 AI", en: "Ask AI", promptZh: "请回答我关于这段内容的问题", promptEn: "Answer my question about this passage" },
  { id: "highlight", zh: "摘录", en: "Highlight", local: "highlight" },
  { id: "reflection", zh: "感想", en: "Reflect", local: "reflection" }
];

export const ACTIONS: Record<ReadingCategory, SelectionAction[]> = {
  poetry: [
    { id: "appreciate", zh: "赏析", en: "Appreciate", promptZh: "请从语言、节奏和情感上赏析这段诗句", promptEn: "Appreciate this poem through language, rhythm, and emotion" },
    { id: "line", zh: "逐句", en: "Line by line", promptZh: "请逐句解释这段诗", promptEn: "Explain this poem line by line" },
    { id: "imagery", zh: "意象", en: "Imagery", promptZh: "请解析其中的意象及其关系", promptEn: "Analyze the imagery and how it works together" },
    { id: "allusion", zh: "典故", en: "Allusions", promptZh: "请查明并解释可能的典故或文化背景", promptEn: "Identify and explain possible allusions or cultural context" },
    { id: "pinyin", zh: "拼音", en: "Pinyin", local: "pinyin" },
    ...COMMON
  ],
  article: [
    { id: "explain", zh: "解释", en: "Explain", promptZh: "请用清晰的语言解释这段内容", promptEn: "Explain this passage clearly" },
    { id: "translate", zh: "翻译", en: "Translate", promptZh: "请翻译并保留原文语气", promptEn: "Translate while preserving tone" },
    ...COMMON
  ],
  book: [
    { id: "explain", zh: "解释", en: "Explain", promptZh: "请解释这段内容", promptEn: "Explain this passage" },
    { id: "context", zh: "上下文", en: "Context", promptZh: "请结合上下文说明它的作用", promptEn: "Explain its role in the surrounding context" },
    { id: "character", zh: "人物", en: "Characters", promptZh: "请分析相关人物及其动机", promptEn: "Analyze the characters and their motivations" },
    { id: "theme", zh: "主题", en: "Themes", promptZh: "请分析这段内容关联的主题", promptEn: "Analyze the themes connected to this passage" },
    { id: "translate", zh: "翻译", en: "Translate", promptZh: "请翻译并保留原文语气", promptEn: "Translate while preserving tone" },
    ...COMMON
  ]
};

export function inferCategory(kind: DocumentKind, title: string, sample = ""): ReadingCategory {
  const text = `${title}\n${sample.slice(0, 1200)}`;
  if (/诗|词|曲|poem|poetry|sonnet|haiku|\n.{1,28}\n.{1,28}(?:\n|$)/iu.test(text)) return "poetry";
  if (kind === "pdf" || /论文|报告|article|paper|journal|abstract|摘要/iu.test(text)) return "article";
  return "book";
}

export function parseAiCategory(value: string, fallback: ReadingCategory): ReadingCategory {
  const match = value.toLowerCase().match(/\b(poetry|book|article)\b/u)?.[1];
  return match === "poetry" || match === "book" || match === "article" ? match : fallback;
}
