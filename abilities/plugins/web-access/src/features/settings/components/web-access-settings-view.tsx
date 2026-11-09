import { useTranslation } from "@vetta-org/plugin-sdk";
import {
  DEFAULT_SETTINGS,
  JINA_SECRET_KEY,
  MAX_CHARS,
  MAX_RESULT_COUNT,
  MIN_CHARS,
  MIN_RESULT_COUNT,
  type WebAccessSettings
} from "../../../domain/settings";
import type { NetworkRequest } from "../../../services/network";
import type { WebAccessStore } from "../../../services/settings-store";
import { Icon } from "../../../shared/components/icon";
import { useWebAccessSettings } from "../hooks/use-web-access-settings";
import { KeyRow } from "./key-row";
import { NumberStepper } from "./number-stepper";
import { ProviderChoiceGrid, type ProviderChoice } from "./provider-choice-grid";
import { SegmentedControl } from "./segmented-control";
import { SettingsCard } from "./settings-card";
import { TestSearchPanel } from "./test-search-panel";
import { TextField } from "./text-field";
import { ToggleRow } from "./toggle-row";

interface WebAccessSettingsViewProps {
  store: WebAccessStore;
  call: NetworkRequest;
  notify(message: string, error?: unknown): void;
}

export function WebAccessSettingsView({ store, call, notify }: WebAccessSettingsViewProps) {
  const { t } = useTranslation();
  const form = useWebAccessSettings(store);
  const { settings } = form;

  const update = <K extends keyof WebAccessSettings>(key: K, value: WebAccessSettings[K]) => form.update({ [key]: value });
  const providerName = (value: string) => (value === "exa-mcp" ? t("provider.exaMcp") : t(`provider.${value}`));

  if (form.loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-xs text-muted-foreground">
        {t("settings.title")}…
      </div>
    );
  }

  const providers: ProviderChoice[] = [
    {
      value: "auto",
      label: t("settings.search.provider.auto"),
      description: t("settings.search.provider.autoHint"),
      badge: t("settings.badge.recommended"),
      icon: "sparkle",
      featured: true
    },
    {
      value: "exa-mcp",
      label: t("provider.exa"),
      monogram: "E",
      badge: t("settings.badge.free"),
      description: t("settings.search.exaMcp.desc")
    },
    {
      value: "exa",
      label: t("provider.exa"),
      monogram: "E",
      badge: t("settings.badge.key"),
      description: t("settings.search.exa.desc")
    },
    {
      value: "brave",
      label: t("provider.brave"),
      monogram: "B",
      badge: t("settings.badge.key"),
      description: t("settings.search.brave.desc")
    },
    {
      value: "tavily",
      label: t("provider.tavily"),
      monogram: "T",
      badge: t("settings.badge.key"),
      description: t("settings.search.tavily.desc")
    },
    {
      value: "bocha",
      label: t("provider.bocha"),
      monogram: t("settings.monogram.bocha"),
      badge: t("settings.badge.key"),
      description: t("settings.search.bocha.desc")
    },
    {
      value: "searxng",
      label: t("provider.searxng"),
      monogram: "S",
      badge: t("settings.badge.selfHosted"),
      description: t("settings.search.searxng.desc")
    }
  ];

  const searchReady = settings.searchProvider === "auto";
  const save = () => {
    void form
      .save()
      .then(() => notify(t("settings.saved")))
      .catch((error: unknown) => notify(t("settings.error.save"), error));
  };

  return (
    <div className="flex h-full min-h-full flex-col bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div>
          <div className="mx-auto max-w-5xl px-8 pb-12 pt-10">
            <header className="mb-8 flex flex-wrap items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-card text-primary shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                <Icon name="globe" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight">{t("settings.title")}</h1>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      searchReady
                        ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400"
                        : "border-border/70 bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${searchReady ? "bg-emerald-500" : "bg-primary"}`} />
                    {searchReady
                      ? t("settings.status.ready")
                      : t("settings.status.custom", { provider: providerName(settings.searchProvider) })}
                  </span>
                </div>
                <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{t("settings.subtitle")}</p>
              </div>
            </header>

            {form.error ? (
              <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/[0.07] px-4 py-3">
                <p className="text-xs font-medium text-destructive">{t("settings.error.generic")}</p>
                <p className="mt-0.5 break-words text-[11px] leading-relaxed text-destructive/80">{form.error}</p>
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
              <div className="space-y-5">
                <SettingsCard
                  icon="search"
                  title={t("settings.search.section")}
                  description={t("settings.search.section.desc")}
                >
                  <ProviderChoiceGrid
                    name="search-provider"
                    ariaLabel={t("settings.search.provider")}
                    value={settings.searchProvider}
                    options={providers}
                    onChange={(value) => update("searchProvider", value as WebAccessSettings["searchProvider"])}
                  />
                  <div className="space-y-4 border-t border-border/50 pt-4">
                    <NumberStepper
                      label={t("settings.search.count")}
                      unit={t("settings.search.countUnit")}
                      value={settings.resultCount}
                      min={MIN_RESULT_COUNT}
                      max={MAX_RESULT_COUNT}
                      onChange={(value) => update("resultCount", value)}
                    />
                    {settings.searchProvider === "auto" || settings.searchProvider === "searxng" ? (
                      <TextField
                        label={t("settings.search.searxngUrl")}
                        hint={t("settings.search.searxngHint")}
                        placeholder="https://search.example.com"
                        value={settings.searxngUrl}
                        onChange={(value) => update("searxngUrl", value)}
                      />
                    ) : null}
                  </div>
                </SettingsCard>

                <SettingsCard
                  icon="document"
                  title={t("settings.fetch.section")}
                  description={t("settings.fetch.section.desc")}
                >
                  <div className="space-y-2">
                    <SegmentedControl
                      ariaLabel={t("settings.fetch.mode")}
                      value={settings.fetchMode}
                      onChange={(value) => update("fetchMode", value as WebAccessSettings["fetchMode"])}
                      options={[
                        { value: "auto", label: t("settings.fetch.mode.auto") },
                        { value: "direct", label: t("settings.fetch.mode.direct") },
                        { value: "jina", label: t("settings.fetch.mode.jina") }
                      ]}
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t(`settings.fetch.mode.hint.${settings.fetchMode}`)}
                    </p>
                  </div>
                  <NumberStepper
                    label={t("settings.fetch.maxChars")}
                    unit={t("settings.fetch.charsUnit")}
                    value={settings.maxChars}
                    min={MIN_CHARS}
                    max={MAX_CHARS}
                    step={1000}
                    onChange={(value) => update("maxChars", value)}
                  />
                  <div className="border-t border-border/50 pt-4">
                    <ToggleRow
                      title={t("settings.fetch.remoteFallback")}
                      description={t("settings.fetch.remoteFallbackHint")}
                      checked={settings.remoteFallback}
                      onChange={(checked) => update("remoteFallback", checked)}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard
                  icon="key"
                  title={t("settings.key.section")}
                  description={t("settings.key.section.desc")}
                >
                  <div className="space-y-2">
                    <KeyRow
                      label={t("provider.exa")}
                      monogram="E"
                      hint={t("settings.key.hint.exa")}
                      secretKey="exaApiKey"
                      state={form.keys.exaApiKey}
                      onSave={form.saveKey}
                      onClear={form.clearKey}
                    />
                    <KeyRow
                      label={t("provider.brave")}
                      monogram="B"
                      hint={t("settings.key.hint.brave")}
                      secretKey="braveApiKey"
                      state={form.keys.braveApiKey}
                      onSave={form.saveKey}
                      onClear={form.clearKey}
                    />
                    <KeyRow
                      label={t("provider.tavily")}
                      monogram="T"
                      hint={t("settings.key.hint.tavily")}
                      secretKey="tavilyApiKey"
                      state={form.keys.tavilyApiKey}
                      onSave={form.saveKey}
                      onClear={form.clearKey}
                    />
                    <KeyRow
                      label={t("provider.bocha")}
                      monogram={t("settings.monogram.bocha")}
                      hint={t("settings.key.hint.bocha")}
                      secretKey="bochaApiKey"
                      state={form.keys.bochaApiKey}
                      onSave={form.saveKey}
                      onClear={form.clearKey}
                    />
                    <KeyRow
                      label={t("provider.jina")}
                      monogram="J"
                      hint={t("settings.key.hint.jina")}
                      secretKey={JINA_SECRET_KEY}
                      state={form.keys[JINA_SECRET_KEY]}
                      optional
                      onSave={form.saveKey}
                      onClear={form.clearKey}
                    />
                  </div>
                </SettingsCard>
              </div>

              <div className="space-y-5 lg:sticky lg:top-0">
                <SettingsCard icon="bolt" title={t("settings.test.section")} description={t("settings.test.hint")}>
                  <TestSearchPanel store={store} call={call} settings={settings} />
                </SettingsCard>

                <SettingsCard
                  icon="shield"
                  title={t("settings.privacy.section")}
                  description={t("settings.privacy.section.desc")}
                >
                  <ToggleRow
                    title={t("settings.privacy.allowPrivate")}
                    description={t("settings.privacy.allowPrivateHint")}
                    checked={settings.allowPrivateHosts}
                    onChange={(checked) => update("allowPrivateHosts", checked)}
                  />
                </SettingsCard>

                <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
                  {t("settings.defaultNote", { results: String(DEFAULT_SETTINGS.resultCount) })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-8 py-3">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {form.dirty ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {t("settings.unsaved")}
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                {t("settings.synced")}
              </>
            )}
          </p>
          <button
            type="button"
            disabled={form.saving || !form.dirty}
            className="rounded-lg bg-primary px-4 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
            onClick={save}
          >
            {t("settings.save")}
          </button>
        </div>
      </footer>
    </div>
  );
}
