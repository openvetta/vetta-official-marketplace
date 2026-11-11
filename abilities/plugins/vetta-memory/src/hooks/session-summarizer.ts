import { buildSummaryPrompt, parseSummary, shouldSummarize, SUMMARY_SYSTEM_PROMPT } from "../domain/session-summary";
import type { Exchange } from "../domain/session-tracker";
import type { AiDeps } from "./auto-extractor";

export const SUMMARY_TIMEOUT_MS = 20_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
        work.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/** Writes a short end-of-session entry to the daily log. Never throws; returns whether an entry was written. */
export async function summarizeSession(deps: AiDeps, cwd: string, exchanges: readonly Exchange[]): Promise<boolean> {
    const { services } = deps;
    await services.loadAll();
    const settings = services.memories.getSettings();
    if (!settings.enabled || !settings.sessionSummary || !shouldSummarize(exchanges)) return false;
    try {
        const result = await withTimeout(
            deps.complete({
                ...(settings.modelKey ? { modelKey: settings.modelKey } : {}),
                systemPrompt: SUMMARY_SYSTEM_PROMPT,
                prompt: buildSummaryPrompt(exchanges),
                temperature: 0.2,
                maxTokens: 400,
            }),
            SUMMARY_TIMEOUT_MS,
        );
        const text = parseSummary(result.text);
        if (!text) return false;
        await services.daily.append(text, { kind: "summary", cwd });
        return true;
    } catch (error) {
        deps.onError("Session summary failed", error);
        return false;
    }
}
