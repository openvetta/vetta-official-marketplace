import { useTranslation } from "@vetta-org/plugin-sdk";
import { SettingRow } from "@vetta-org/theme-ui/plugin-ui";
import { Button, Input } from "@vetta-org/ui";
import { useState } from "react";
import type { SearchOutcome } from "../../../domain/search-types";
import type { WebAccessSettings } from "../../../domain/settings";
import type { NetworkRequest } from "../../../services/network";
import { providerLabel, testSearch } from "../../../services/search-providers";
import type { WebAccessStore } from "../../../services/settings-store";

interface TestSearchPanelProps {
  store: WebAccessStore;
  call: NetworkRequest;
  settings: WebAccessSettings;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return url;
  }
}

/**
 * Query box and results, rendered as rows of the surrounding `SettingSection` so
 * the panel keeps the host's settings rhythm instead of a second card style.
 */
export function TestSearchPanel({ store, call, settings }: TestSearchPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("Vetta desktop agent");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ outcome: SearchOutcome; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    const started = Date.now();
    try {
      const outcome = await testSearch({ call, settings, secret: store.secret }, query);
      setResult({ outcome, ms: Date.now() - started });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const results = result?.outcome.results ?? [];
  const hasBody = Boolean(error || result);

  return (
    <>
      <SettingRow title={t("settings.test.query")} border={hasBody}>
        <div className="flex items-center gap-2">
          <Input
            aria-label={t("settings.test.query")}
            className="w-52"
            value={query}
            placeholder={t("settings.test.query")}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !busy && query.trim()) void run();
            }}
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || !query.trim()}
            onClick={() => void run()}
          >
            {busy ? t("settings.test.running") : t("settings.test.run")}
          </Button>
        </div>
      </SettingRow>

      {error ? (
        <div className="px-4 py-2.5">
          <p className="text-[12px] font-medium text-destructive">{t("settings.test.failed")}</p>
          <p className="mt-0.5 break-words text-[11px] leading-relaxed text-destructive/80">{error}</p>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{providerLabel(result.outcome.provider)}</span>
            <span>{t("settings.test.count", { count: String(results.length) })}</span>
            <span>·</span>
            <span className="tabular-nums">{result.ms} ms</span>
          </div>
          {results.length === 0 ? (
            <p className="px-4 py-2.5 text-[11px] text-muted-foreground">{t("settings.test.empty")}</p>
          ) : (
            results.map((hit, index) => (
              <SettingRow
                key={hit.url}
                title={hit.title}
                description={hit.snippet}
                border={index < results.length - 1}
              >
                <span className="text-[11px] text-muted-foreground">{hostOf(hit.url)}</span>
              </SettingRow>
            ))
          )}
        </>
      ) : null}
    </>
  );
}
