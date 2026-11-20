import { useTranslation } from "@vetta-org/plugin-sdk";
import { MotionSelect, SettingRow, SettingSection } from "@vetta-org/theme-ui/plugin-ui";
import { Input, Stepper, Switch } from "@vetta-org/ui";
import { useEffect } from "react";
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
import { useWebAccessSettings } from "../hooks/use-web-access-settings";
import { KeyRow } from "./key-row";
import { TestSearchPanel } from "./test-search-panel";

interface WebAccessSettingsViewProps {
  store: WebAccessStore;
  call: NetworkRequest;
  notify(message: string, error?: unknown): void;
}

/**
 * The workspace page: one column, no save button. Every control is the host's own
 * (settings chrome, `MotionSelect`, `Stepper`, `Switch`, `Input`, `Dialog`) and every
 * edit is written as it happens, so there is nothing for the user to remember to press.
 */
export function WebAccessSettingsView({ store, call, notify }: WebAccessSettingsViewProps) {
  const { t } = useTranslation();
  const form = useWebAccessSettings(store);
  const { settings } = form;

  const update = <K extends keyof WebAccessSettings>(key: K, value: WebAccessSettings[K]) => form.update({ [key]: value });
  const providerName = (value: string) => (value === "exa-mcp" ? t("provider.exaMcp") : t(`provider.${value}`));
  const stepperLabels = { increase: t("settings.stepper.increase"), decrease: t("settings.stepper.decrease") };

  useEffect(() => {
    if (form.status === "error" && form.error) notify(t("settings.error.save"), new Error(form.error));
  }, [form.status, form.error, notify, t]);

  if (form.loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-[12px] text-muted-foreground">
        {t("settings.title")}…
      </div>
    );
  }

  const providers = [
    {
      value: "auto",
      label: t("settings.search.provider.auto"),
      badge: t("settings.badge.recommended"),
      description: t("settings.search.provider.autoHint")
    },
    {
      value: "exa-mcp",
      label: t("provider.exa"),
      badge: t("settings.badge.free"),
      description: t("settings.search.exaMcp.desc")
    },
    {
      value: "exa",
      label: t("provider.exa"),
      badge: t("settings.badge.key"),
      description: t("settings.search.exa.desc")
    },
    {
      value: "brave",
      label: t("provider.brave"),
      badge: t("settings.badge.key"),
      description: t("settings.search.brave.desc")
    },
    {
      value: "tavily",
      label: t("provider.tavily"),
      badge: t("settings.badge.key"),
      description: t("settings.search.tavily.desc")
    },
    {
      value: "bocha",
      label: t("provider.bocha"),
      badge: t("settings.badge.key"),
      description: t("settings.search.bocha.desc")
    },
    {
      value: "searxng",
      label: t("provider.searxng"),
      badge: t("settings.badge.selfHosted"),
      description: t("settings.search.searxng.desc")
    }
  ];
  const selectedProvider = providers.find((provider) => provider.value === settings.searchProvider) ?? providers[0];

  const searchReady = settings.searchProvider === "auto";
  const showSearxngUrl = settings.searchProvider === "auto" || settings.searchProvider === "searxng";
  const statusText =
    form.status === "saving"
      ? t("settings.status.saving")
      : form.status === "error"
        ? t("settings.status.failed")
        : form.status === "saved"
          ? t("settings.status.saved")
          : null;

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-8 pb-12 pt-10">
        <header className="mb-6 space-y-1">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-[15px] font-semibold text-foreground">{t("settings.title")}</h1>
            {statusText ? (
              <span className="shrink-0 text-[11px] text-muted-foreground" aria-live="polite">
                {statusText}
              </span>
            ) : null}
          </div>
          <p className="max-w-xl text-[12px] leading-relaxed text-muted-foreground">{t("settings.subtitle")}</p>
          <p className="text-[11px] text-muted-foreground">
            {searchReady
              ? t("settings.status.ready")
              : t("settings.status.custom", { provider: providerName(settings.searchProvider) })}
          </p>
        </header>

        {form.error ? (
          <p className="mb-5 break-words text-[12px] leading-relaxed text-destructive">
            {t("settings.error.generic")} · {form.error}
          </p>
        ) : null}

        <SettingSection
          section={{ id: "web-access-search", title: t("settings.search.section") }}
          description={t("settings.search.section.desc")}
        >
          <SettingRow title={t("settings.search.provider")} description={selectedProvider.description}>
            <MotionSelect
              aria-label={t("settings.search.provider")}
              value={settings.searchProvider}
              triggerClassName="min-w-[11rem]"
              onValueChange={(value) => update("searchProvider", value as WebAccessSettings["searchProvider"])}
              options={providers.map((provider) => ({
                value: provider.value,
                label: `${provider.label} · ${provider.badge}`
              }))}
            />
          </SettingRow>
          <SettingRow title={t("settings.search.count")} border={showSearxngUrl}>
            <Stepper
              aria-label={t("settings.search.count")}
              value={settings.resultCount}
              min={MIN_RESULT_COUNT}
              max={MAX_RESULT_COUNT}
              labels={stepperLabels}
              onValueChange={(value) => update("resultCount", value)}
            />
          </SettingRow>
          {showSearxngUrl ? (
            <SettingRow
              title={t("settings.search.searxngUrl")}
              description={t("settings.search.searxngHint")}
              border={false}
            >
              <Input
                aria-label={t("settings.search.searxngUrl")}
                className="w-64"
                placeholder="https://search.example.com"
                spellCheck={false}
                value={settings.searxngUrl}
                onChange={(event) => update("searxngUrl", event.target.value)}
              />
            </SettingRow>
          ) : null}
        </SettingSection>

        <SettingSection
          section={{ id: "web-access-fetch", title: t("settings.fetch.section") }}
          description={t("settings.fetch.section.desc")}
        >
          <SettingRow title={t("settings.fetch.mode")} description={t(`settings.fetch.mode.hint.${settings.fetchMode}`)}>
            <MotionSelect
              aria-label={t("settings.fetch.mode")}
              value={settings.fetchMode}
              triggerClassName="min-w-[9rem]"
              onValueChange={(value) => update("fetchMode", value as WebAccessSettings["fetchMode"])}
              options={[
                { value: "auto", label: t("settings.fetch.mode.auto") },
                { value: "direct", label: t("settings.fetch.mode.direct") },
                { value: "jina", label: t("settings.fetch.mode.jina") }
              ]}
            />
          </SettingRow>
          <SettingRow title={t("settings.fetch.maxChars")}>
            <Stepper
              aria-label={t("settings.fetch.maxChars")}
              value={settings.maxChars}
              min={MIN_CHARS}
              max={MAX_CHARS}
              step={1000}
              labels={stepperLabels}
              onValueChange={(value) => update("maxChars", value)}
            />
          </SettingRow>
          <SettingRow
            title={t("settings.fetch.remoteFallback")}
            description={t("settings.fetch.remoteFallbackHint")}
            border={false}
          >
            <Switch
              aria-label={t("settings.fetch.remoteFallback")}
              checked={settings.remoteFallback}
              onCheckedChange={(checked) => update("remoteFallback", checked)}
            />
          </SettingRow>
        </SettingSection>

        <SettingSection
          section={{ id: "web-access-keys", title: t("settings.key.section") }}
          description={t("settings.key.section.desc")}
        >
          <KeyRow
            label={t("provider.exa")}
            hint={t("settings.key.hint.exa")}
            secretKey="exaApiKey"
            state={form.keys.exaApiKey}
            onSave={form.saveKey}
            onClear={form.clearKey}
          />
          <KeyRow
            label={t("provider.brave")}
            hint={t("settings.key.hint.brave")}
            secretKey="braveApiKey"
            state={form.keys.braveApiKey}
            onSave={form.saveKey}
            onClear={form.clearKey}
          />
          <KeyRow
            label={t("provider.tavily")}
            hint={t("settings.key.hint.tavily")}
            secretKey="tavilyApiKey"
            state={form.keys.tavilyApiKey}
            onSave={form.saveKey}
            onClear={form.clearKey}
          />
          <KeyRow
            label={t("provider.bocha")}
            hint={t("settings.key.hint.bocha")}
            secretKey="bochaApiKey"
            state={form.keys.bochaApiKey}
            onSave={form.saveKey}
            onClear={form.clearKey}
          />
          <KeyRow
            label={t("provider.jina")}
            hint={t("settings.key.hint.jina")}
            secretKey={JINA_SECRET_KEY}
            state={form.keys[JINA_SECRET_KEY]}
            optional
            border={false}
            onSave={form.saveKey}
            onClear={form.clearKey}
          />
        </SettingSection>

        <SettingSection
          section={{ id: "web-access-test", title: t("settings.test.section") }}
          description={t("settings.test.hint")}
        >
          <TestSearchPanel store={store} call={call} settings={settings} />
        </SettingSection>

        <SettingSection
          section={{ id: "web-access-privacy", title: t("settings.privacy.section") }}
          description={t("settings.privacy.section.desc")}
        >
          <SettingRow
            title={t("settings.privacy.allowPrivate")}
            description={t("settings.privacy.allowPrivateHint")}
            border={false}
          >
            <Switch
              aria-label={t("settings.privacy.allowPrivate")}
              checked={settings.allowPrivateHosts}
              onCheckedChange={(checked) => update("allowPrivateHosts", checked)}
            />
          </SettingRow>
        </SettingSection>

        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          {t("settings.defaultNote", { results: String(DEFAULT_SETTINGS.resultCount) })}
        </p>
      </div>
    </div>
  );
}
