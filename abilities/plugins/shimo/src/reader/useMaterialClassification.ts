import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { useEffect } from "react";
import { inferCategory, parseAiCategory } from "../classification";
import type { MaterialManifest } from "../domain";
import type { ShimoRuntime } from "../runtime";

export function useMaterialClassification(
  runtime: ShimoRuntime,
  manifest: MaterialManifest | null,
  content: string,
  modelKey: string | null,
  t: PluginTranslate,
  onClassified: (manifest: MaterialManifest) => void,
  showStatus: (message: string | null) => void
): void {
  useEffect(() => {
    if (!manifest || !modelKey || manifest.classification?.source === "ai" || (!content && manifest.kind !== "pdf")) return;
    let cancelled = false;
    const fallback = inferCategory(manifest.kind, manifest.title, content);
    showStatus(t("status.classifying"));

    void runtime.context.ai.complete({
      modelKey,
      systemPrompt: "Classify reading material. Reply with exactly one token: poetry, book, or article.",
      prompt: `Title: ${manifest.title}\nFormat: ${manifest.kind}\nSample: ${content.slice(0, 1800)}`,
      temperature: 0,
      maxTokens: 8
    }).then(async (result) => {
      if (cancelled) return;
      const updatedAt = new Date().toISOString();
      const next: MaterialManifest = {
        ...manifest,
        category: parseAiCategory(result.text, fallback),
        classification: { source: "ai", updatedAt },
        updatedAt
      };
      await runtime.repository.updateManifest(next);
      if (!cancelled) onClassified(next);
    }).catch(() => undefined).finally(() => {
      if (!cancelled) showStatus(null);
    });

    return () => { cancelled = true; };
  }, [content, manifest?.id, modelKey, onClassified, runtime, showStatus, t]);
}
