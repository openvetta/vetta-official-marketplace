import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import {
  ModelSelectorView,
  PROVIDER_ICONS,
  type ModelSelectorOptionView,
  type ModelSelectorProviderGroup
} from "@vetta/theme-ui/plugin-ui";
import { useMemo, type ReactElement } from "react";
import type { ReadingAiModel } from "../../ai";

interface ReadingModelSelectorProps {
  models: ReadingAiModel[];
  value: string | null;
  defaultKey: string | null;
  t: PluginTranslate;
  onChange(modelKey: string): Promise<void>;
  onRefresh(): Promise<void>;
}

const PROVIDER_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["anthropic", "claude"],
  ["google", "gemini"],
  ["moonshot", "kimi"],
  ["x-ai", "grok"],
  ["xai", "grok"],
  ["glm", "zhipu"]
];

function providerIconSymbol(provider: string, models: readonly ReadingAiModel[]): string | undefined {
  const searchValue = `${provider} ${models.map((model) => `${model.id} ${model.name}`).join(" ")}`.toLowerCase();
  const direct = Object.keys(PROVIDER_ICONS).find((symbol) => searchValue.includes(symbol));
  if (direct) return direct;
  return PROVIDER_ALIASES.find(([alias]) => searchValue.includes(alias))?.[1];
}

function providerLabel(provider: string): string {
  const segment = provider.split(".").at(-1) ?? provider;
  return segment
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toOption(model: ReadingAiModel): ModelSelectorOptionView {
  return {
    key: model.modelKey,
    provider: model.provider,
    modelId: model.id,
    displayName: model.name,
    tags: [model.id, model.provider],
    supportsImage: model.supportsImage
  };
}

export function ReadingModelSelector({
  models,
  value,
  defaultKey,
  t,
  onChange,
  onRefresh
}: ReadingModelSelectorProps): ReactElement {
  const groups = useMemo<ModelSelectorProviderGroup[]>(() => {
    const grouped = new Map<string, ReadingAiModel[]>();
    for (const model of models) grouped.set(model.provider, [...(grouped.get(model.provider) ?? []), model]);
    return Array.from(grouped, ([provider, providerModels]) => ({
      provider,
      label: providerLabel(provider),
      icon: providerIconSymbol(provider, providerModels),
      models: providerModels.map(toOption)
    }));
  }, [models]);

  const selectedOption = useMemo(
    () => (value ? models.find((model) => model.modelKey === value) : undefined),
    [models, value]
  );

  return (
    <ModelSelectorView
      selectedModel={value ?? undefined}
      selectedOption={selectedOption ? toOption(selectedOption) : null}
      groups={groups}
      defaultKey={defaultKey ?? undefined}
      menuLevels={[]}
      labels={{
        placeholder: t("ai.selectModel"),
        searchPlaceholder: t("ai.searchModels"),
        clearSearch: t("ai.clearModelSearch"),
        noResults: t("ai.noModelResults"),
        noResultsHint: t("ai.noModelResultsHint"),
        reasoningHeader: "",
        modelHeader: t("ai.modelsHeader"),
        cloudOnly: t("ai.cloudOnly"),
        visionBadge: t("ai.vision"),
        defaultBadge: t("ai.defaultModel"),
        levelLabel: (level) => level
      }}
      className="w-48"
      classNames={{
        trigger: "h-8 w-48 max-w-48 justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
      }}
      onModelSelect={(modelKey) => void onChange(modelKey)}
      onReasoningSelect={() => undefined}
      onOpenChange={(open) => {
        if (open) void onRefresh();
      }}
    />
  );
}
