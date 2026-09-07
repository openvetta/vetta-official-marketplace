import { useCallback, useEffect, useState } from "react";
import { resolveReadingModelKey, toReadingAiModels, type ReadingAiModel } from "../ai";
import type { ShimoRuntime } from "../runtime";

export interface ReadingAiModelState {
  models: ReadingAiModel[];
  modelKey: string | null;
  loading: boolean;
  error: string | null;
  select(modelKey: string): Promise<void>;
  refresh(): Promise<void>;
}

export function useReadingAiModel(runtime: ShimoRuntime): ReadingAiModelState {
  const [models, setModels] = useState<ReadingAiModel[]>([]);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [settings, listed] = await Promise.all([
        runtime.repository.getAiSettings(),
        runtime.context.ai.listModels(),
      ]);
      const nextModels = toReadingAiModels(listed);
      const nextModelKey = resolveReadingModelKey(settings, nextModels, listed.defaultModel);
      setModels(nextModels);
      setModelKey(nextModelKey);
      setError(nextModelKey ? null : "no-models");
      if (nextModelKey && settings.modelKey !== nextModelKey) {
        await runtime.repository.saveAiSettings({ schemaVersion: 1, modelKey: nextModelKey });
      }
    } catch (cause) {
      setModels([]);
      setModelKey(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [runtime]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = useCallback(async (nextModelKey: string): Promise<void> => {
    if (!models.some((model) => model.modelKey === nextModelKey)) {
      throw new Error(`AI model is not available: ${nextModelKey}`);
    }
    await runtime.repository.saveAiSettings({ schemaVersion: 1, modelKey: nextModelKey });
    setModelKey(nextModelKey);
    setError(null);
  }, [models, runtime.repository]);

  return { models, modelKey, loading, error, select, refresh };
}
