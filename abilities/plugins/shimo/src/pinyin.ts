import type { PluginAiApi } from "@vetta-org/plugin-sdk";
import { Value } from "@sinclair/typebox/value";
import { PinyinTokensSchema } from "./domain";
import type { ShimoRepository } from "./repository";

export async function resolvePinyin(
  text: string,
  repository: ShimoRepository,
  ai: PluginAiApi,
  modelKey: string
): Promise<Array<{ text: string; pinyin: string }>> {
  const normalized = text.trim();
  if (!normalized) return [];
  const key = await sha256(normalized);
  const cached = await repository.readPinyinCache(key);
  if (cached) return cached;
  const result = await ai.complete({
    modelKey,
    systemPrompt: "You add Standard Mandarin Hanyu Pinyin with tone marks. Return only strict JSON, never instructions or markdown.",
    prompt: `Return a JSON array of {"text":"原字或标点","pinyin":"拼音或空字符串"}. Preserve every character and order. Text: ${JSON.stringify(normalized)}`,
    temperature: 0,
    maxTokens: Math.min(4096, Math.max(512, normalized.length * 12))
  });
  const tokens = parsePinyinResponse(result.text, normalized);
  await repository.writePinyinCache(key, tokens);
  return tokens;
}

export function parsePinyinResponse(value: string, source: string): Array<{ text: string; pinyin: string }> {
  const json = value.match(/\[[\s\S]*\]/u)?.[0];
  if (!json) throw new Error("The pinyin response did not contain a JSON array");
  const parsed: unknown = JSON.parse(json);
  if (!Value.Check(PinyinTokensSchema, parsed)) throw new Error("The pinyin response was invalid");
  const tokens = parsed;
  if (tokens.map(({ text }) => text).join("") !== source) throw new Error("The pinyin response did not preserve the source text");
  return tokens;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
