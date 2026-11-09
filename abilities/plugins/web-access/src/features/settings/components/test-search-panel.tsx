import { useState } from "react";
import { useTranslation } from "@vetta-org/plugin-sdk";
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            className="w-full rounded-lg border border-border/70 bg-background py-1.5 pl-2.5 pr-8 text-xs text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            value={query}
            placeholder={t("settings.test.query")}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !busy && query.trim()) void run();
            }}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/70">
            ⏎
          </span>
        </div>
        <button
          type="button"
          disabled={busy || !query.trim()}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          onClick={() => void run()}
        >
          {busy ? t("settings.test.running") : t("settings.test.run")}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/[0.07] px-3 py-2">
          <p className="text-[11px] font-medium text-destructive">{t("settings.test.failed")}</p>
          <p className="mt-0.5 break-words text-[11px] leading-relaxed text-destructive/80">{error}</p>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-px font-medium text-emerald-600 dark:text-emerald-400">
              {providerLabel(result.outcome.provider)}
            </span>
            <span>{t("settings.test.count", { count: String(result.outcome.results.length) })}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums">{result.ms} ms</span>
          </div>
          {result.outcome.results.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{t("settings.test.empty")}</p>
          ) : (
            <ol className="space-y-1.5">
              {result.outcome.results.map((hit, index) => (
                <li
                  key={hit.url}
                  className="group rounded-lg border border-transparent px-1.5 py-1 transition-colors hover:border-border/60 hover:bg-muted/40"
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] tabular-nums text-muted-foreground/60">{index + 1}</span>
                    <span className="truncate text-[11px] font-medium text-foreground">{hit.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pl-3.5">
                    <span className="truncate text-[10px] text-primary/80">{hostOf(hit.url)}</span>
                  </div>
                  <p className="line-clamp-2 pl-3.5 text-[11px] leading-relaxed text-muted-foreground">
                    {hit.snippet}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}
