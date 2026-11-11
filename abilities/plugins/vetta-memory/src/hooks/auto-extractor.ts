import type { PluginAiCompleteRequest, PluginAiCompleteResult } from "@vetta-org/plugin-sdk";
import {
    buildExtractionPrompt,
    EXTRACTION_SYSTEM_PROMPT,
    parseExtraction,
    shouldExtract,
} from "../domain/memory-extraction";
import type { MemoryServices } from "../domain/memory-services";
import { isVisibleIn } from "../domain/memory-types";
import type { Exchange } from "../domain/session-tracker";

export interface AiDeps {
    services: MemoryServices;
    complete(request: PluginAiCompleteRequest): Promise<Pick<PluginAiCompleteResult, "text">>;
    onError(message: string, error: unknown): void;
}

/**
 * Extracts durable memories from one finished exchange. Never throws: model
 * failures go to `onError`, so a flaky model cannot break the chat. Returns
 * how many new memories were created.
 */
export async function extractMemories(deps: AiDeps, cwd: string, exchange: Exchange): Promise<number> {
    const { services } = deps;
    await services.loadAll();
    const settings = services.memories.getSettings();
    if (!settings.enabled || !settings.autoExtract || !shouldExtract(exchange.user)) return 0;
    try {
        const visible = services.memories.list().filter((record) => isVisibleIn(record, cwd));
        const result = await deps.complete({
            ...(settings.modelKey ? { modelKey: settings.modelKey } : {}),
            systemPrompt: EXTRACTION_SYSTEM_PROMPT,
            prompt: buildExtractionPrompt(exchange.user, exchange.assistant, visible),
            temperature: 0,
            maxTokens: 500,
        });
        let created = 0;
        for (const input of parseExtraction(result.text, cwd)) {
            if ((await services.memories.add(input)).created) created++;
        }
        return created;
    } catch (error) {
        deps.onError("Automatic memory extraction failed", error);
        return 0;
    }
}
