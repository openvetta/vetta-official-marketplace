import { cleanBlock, looksSensitive } from "./memory-text";
import type { Exchange } from "./session-tracker";

export const MIN_EXCHANGES_FOR_SUMMARY = 2;
const MAX_SUMMARY = 1200;

export const SUMMARY_SYSTEM_PROMPT = [
    "You write one work-log entry for an AI assistant's daily log, from the exchanges of a session that just ended.",
    "Write 2-5 short lines, each starting with '- ': what was done, decisions made, and follow-ups still open. Use the user's language. Never include secrets or credentials.",
    "Keep it under 600 characters. If nothing worth logging happened, reply with exactly NONE.",
].join("\n");

export function shouldSummarize(exchanges: readonly Exchange[]): boolean {
    return exchanges.length >= MIN_EXCHANGES_FOR_SUMMARY;
}

export function buildSummaryPrompt(exchanges: readonly Exchange[]): string {
    return exchanges
        .map((exchange, index) =>
            [`# Exchange ${index + 1}`, `USER: ${exchange.user}`, `ASSISTANT: ${exchange.assistant ?? "(no reply)"}`].join("\n"),
        )
        .join("\n\n");
}

/** Returns the log text, or `null` when the model found nothing worth keeping. */
export function parseSummary(text: string): string | null {
    const clean = cleanBlock(text.replace(/^```[a-z]*\n?|```$/gim, ""), MAX_SUMMARY);
    if (!clean || /^none\.?$/i.test(clean) || looksSensitive(clean)) return null;
    return clean;
}
