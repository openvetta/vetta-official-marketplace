import type { PluginAiApi, PluginAiCompleteResult } from "@vetta-org/plugin-sdk";
import type { AiSettings } from "./domain";

export interface ReadingAiModel {
  modelKey: string;
  name: string;
  provider: string;
  id: string;
  supportsImage: boolean;
}

export function toReadingAiModels(result: Awaited<ReturnType<PluginAiApi["listModels"]>>): ReadingAiModel[] {
  return result.models.map(({ modelKey, name, provider, id, input }) => ({
    modelKey,
    name,
    provider,
    id,
    supportsImage: input.includes("image")
  }));
}

export function resolveReadingModelKey(
  settings: AiSettings,
  models: readonly ReadingAiModel[],
  hostDefault: string | null,
): string | null {
  const available = new Set(models.map((model) => model.modelKey));
  if (settings.modelKey && available.has(settings.modelKey)) return settings.modelKey;
  if (hostDefault && available.has(hostDefault)) return hostDefault;
  return models[0]?.modelKey ?? null;
}

export async function completeReading(
  ai: PluginAiApi,
  modelKey: string | null,
  systemPrompt: string,
  prompt: string,
  options?: Parameters<PluginAiApi["stream"]>[1],
): Promise<PluginAiCompleteResult> {
  if (!modelKey) throw new Error("No Shimo AI model is selected. Choose a model in Reading preferences.");
  return ai.stream({ modelKey, systemPrompt, prompt, temperature: 0.2, maxTokens: 1600 }, options);
}
