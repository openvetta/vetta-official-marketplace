import { cleanContent, looksSensitive } from "./memory-text";
import { isMemoryKind, isMemoryScope, MEMORY_KINDS, type MemoryInput, type MemoryRecord } from "./memory-types";

export const MAX_EXTRACTED_PER_TURN = 3;
const MIN_PROMPT_LENGTH = 6;

export const EXTRACTION_SYSTEM_PROMPT = [
    "You maintain long-term memory for an AI assistant. Read one finished exchange and decide what, if anything, is worth remembering about the USER across future conversations.",
    "Only keep durable information: stable preferences, personal or team facts, decisions, project conventions, lessons learned, or corrections of the assistant's behaviour. Write each as one short, self-contained sentence in the user's language.",
    "Never keep: secrets, credentials, one-off task details, content the assistant produced, or anything already listed under EXISTING MEMORIES.",
    `Return strict JSON only: {"memories":[{"content":string,"kind":${MEMORY_KINDS.map((kind) => `"${kind}"`).join("|")},"scope":"global"|"project"}]}. Use at most ${MAX_EXTRACTED_PER_TURN} items. Return {"memories":[]} when nothing qualifies. scope "project" is only for facts that apply to the current working directory alone.`,
].join("\n");

export function shouldExtract(prompt: string | undefined | null): prompt is string {
    return typeof prompt === "string" && prompt.trim().length >= MIN_PROMPT_LENGTH;
}

export function buildExtractionPrompt(
    userPrompt: string,
    assistantReply: string | null,
    existing: readonly MemoryRecord[],
): string {
    const known = existing
        .slice(0, 40)
        .map((item) => `- ${item.content}`)
        .join("\n");
    return [
        "EXISTING MEMORIES:",
        known || "(none)",
        "",
        "USER MESSAGE:",
        userPrompt.slice(0, 4000),
        "",
        "ASSISTANT REPLY:",
        (assistantReply ?? "").slice(0, 2000) || "(none)",
    ].join("\n");
}

/** Pulls the first JSON object out of a model reply, tolerating code fences and chatter. */
export function parseExtraction(text: string, projectKey: string | null): MemoryInput[] {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return [];
    let data: unknown;
    try {
        data = JSON.parse(text.slice(start, end + 1));
    } catch {
        return [];
    }
    const list = (data as { memories?: unknown } | null)?.memories;
    if (!Array.isArray(list)) return [];
    const result: MemoryInput[] = [];
    for (const entry of list) {
        if (result.length >= MAX_EXTRACTED_PER_TURN) break;
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const content = typeof e.content === "string" ? cleanContent(e.content) : "";
        if (!content || looksSensitive(content)) continue;
        const scope = isMemoryScope(e.scope) && projectKey ? e.scope : "global";
        result.push({
            content,
            kind: isMemoryKind(e.kind) ? e.kind : "fact",
            scope,
            projectKey: scope === "project" ? projectKey : null,
            source: "auto",
        });
    }
    return result;
}
