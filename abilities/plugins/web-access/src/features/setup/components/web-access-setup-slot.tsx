import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@vetta-org/plugin-sdk";
import type { SearchHit } from "../../../domain/search-types";
import type { WebAccessSettings } from "../../../domain/settings";
import type { NetworkRequest } from "../../../services/network";
import { providerLabel, testSearch } from "../../../services/search-providers";
import type { WebAccessStore } from "../../../services/settings-store";
import { Icon } from "../../../shared/components/icon";
import { TRACKED_KEYS } from "../../settings/hooks/use-web-access-settings";

type Phase = "loading" | "ready";

interface Snapshot {
  settings: WebAccessSettings;
  /** Secret key name → whether a value is stored. */
  keys: Record<string, boolean>;
}

const KEY_MONOGRAMS: Array<[string, string]> = [
  ["exaApiKey", "E"],
  ["braveApiKey", "B"],
  ["tavilyApiKey", "T"],
  ["bochaApiKey", "Bo"],
  ["jinaApiKey", "J"]
];

interface WebAccessSetupSlotProps {
  store: WebAccessStore;
  call: NetworkRequest;
  openSettings(): void;
}

/**
 * The detail page's runtime half: what this plugin is currently set to answer
 * with, proof that it answers, and one door into the full settings page.
 */
export function WebAccessSetupSlot({ store, call, openSettings }: WebAccessSetupSlotProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("loading");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [answeredBy, setAnsweredBy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const readSnapshot = useCallback(async (): Promise<Snapshot> => {
    const settings = await store.ready();
    const states = await Promise.all(TRACKED_KEYS.map((key) => store.secretState(key)));
    return {
      settings,
      keys: Object.fromEntries(TRACKED_KEYS.map((key, index) => [key, states[index] === "saved"]))
    };
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    void readSnapshot()
      .then((next) => {
        if (cancelled) return;
        setSnapshot(next);
        setPhase("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailure(error instanceof Error ? error.message : String(error));
        setPhase("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [readSnapshot]);

  const run = async () => {
    if (!snapshot) return;
    setBusy(true);
    setFailure(null);
    setHits(null);
    try {
      const outcome = await testSearch(
        { call, settings: snapshot.settings, secret: store.secret },
        t("setup.sampleQuery")
      );
      setHits(outcome.results.slice(0, 2));
      setAnsweredBy(providerLabel(outcome.provider));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (phase === "loading") {
    return <div className="h-28 animate-pulse rounded-2xl border border-border/60 bg-muted/20" />;
  }

  const settings = snapshot?.settings;
  const freeTier = !settings || settings.searchProvider === "auto";
  const providerName = settings
    ? settings.searchProvider === "auto"
      ? t("provider.exaMcp")
      : providerLabel(settings.searchProvider)
    : "—";
  const readerName = settings ? t(`settings.fetch.mode.${settings.fetchMode}`) : "—";
  const savedKeys = snapshot ? Object.values(snapshot.keys).filter(Boolean).length : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-border/50 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-foreground">
          <Icon name="globe" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            {t("setup.title")}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                freeTier
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${freeTier ? "bg-emerald-500" : "bg-primary"}`} />
              {freeTier ? t("setup.status.ready") : t("setup.status.custom")}
            </span>
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {freeTier ? t("setup.ready") : t("setup.custom")}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-3 divide-x divide-border/50 border-b border-border/50">
        <Metric label={t("setup.metric.search")} value={providerName} hint={t("setup.metric.search.hint")} />
        <Metric
          label={t("setup.metric.reader")}
          value={readerName}
          hint={
            settings?.remoteFallback === false ? t("setup.metric.reader.local") : t("setup.metric.reader.fallback")
          }
        />
        <Metric
          label={t("setup.metric.results")}
          value={t("setup.metric.results.value", { count: String(settings?.resultCount ?? 0) })}
          hint={t("setup.metric.results.hint")}
        />
      </dl>

      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">
              {t("setup.keys.configured")}
            </span>
            {KEY_MONOGRAMS.map(([key, monogram]) => {
              const has = snapshot?.keys[key] === true;
              return (
                <span
                  key={key}
                  title={has ? t("setup.keys.saved") : t("setup.keys.missing")}
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-semibold ${
                    has
                      ? "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-400"
                      : "bg-muted/60 text-muted-foreground/60 ring-1 ring-transparent"
                  }`}
                >
                  {monogram}
                </span>
              );
            })}
            <span className="ml-1 text-[10px] text-muted-foreground/70">
              {t("setup.keys.count", { saved: String(savedKeys), total: String(TRACKED_KEYS.length) })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
              onClick={openSettings}
            >
              {t("setup.open")}
              <Icon name="chevron" className="h-3 w-3 -rotate-90" />
            </button>
            <button
              type="button"
              disabled={busy || !snapshot}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
              onClick={() => void run()}
            >
              <Icon name="bolt" className={`h-3 w-3 ${busy ? "animate-pulse" : ""}`} />
              {busy ? t("setup.trying") : t("setup.try")}
            </button>
          </div>
        </div>

        {failure ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/[0.07] px-3 py-2">
            <p className="text-[11px] font-medium text-destructive">{t("setup.error")}</p>
            <p className="mt-0.5 break-words text-[11px] leading-relaxed text-destructive/80">{failure}</p>
          </div>
        ) : null}

        {hits && hits.length > 0 ? (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Icon name="check" className="h-3 w-3 text-emerald-500" />
              {t("setup.results", { count: String(hits.length), provider: answeredBy ?? "" })}
            </p>
            <ol className="space-y-1">
              {hits.map((hit) => (
                <li key={hit.url} className="flex items-baseline gap-2">
                  <span className="h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-muted-foreground/40" />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-foreground">{hit.title}</p>
                    <p className="truncate text-[10px] text-primary/80">{hit.url.replace(/^https?:\/\//u, "")}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{label}</dt>
      <dd className="mt-1 truncate text-xs font-medium text-foreground">{value}</dd>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
