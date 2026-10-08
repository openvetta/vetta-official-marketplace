import { ModelCapabilityBadges } from "./model-capability-badges";
import { useTranslation } from "@vetta-org/plugin-sdk";
import { useMemo, useState, type ReactElement } from "react";
import { Button } from "../../../shared/components/button";
import { Spin } from "../../../shared/components/spin";
import { Dialog } from "../../../shared/components/dialog";
import { type ChannelModel, type ProxyAccount } from "../../../proxy-client";
import { formatTokens } from "../../../domain/console-format";

/** Shows what one credential can serve, on demand — the grid stays about health. */
export function ModelDialog({
  account, models, loading, error, onClose
}: {
  account: ProxyAccount;
  models: ChannelModel[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return models;
    return models.filter((model) => `${model.id} ${model.displayName ?? ""}`.toLowerCase().includes(needle));
  }, [models, query]);

  return (
    <Dialog title={t("console.modelsTitle")} description={account.displayName} onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">{t("console.modelCount", { count: models.length })}</span>
          <Button onClick={onClose}>{t("setup.close")}</Button>
        </div>
      }
    >
      {models.length > 8 ? (
        <div className="sticky top-0 border-b border-border/40 bg-card/95 px-4 py-2 backdrop-blur">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("console.filterModels")}
            aria-label={t("console.filterModels")}
            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/60"
          />
        </div>
      ) : null}
      {loading ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground"><Spin /> {t("console.loadingModels")}</p>
      ) : error ? (
        <p className="px-4 py-6 text-center text-xs text-destructive" role="alert">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t(models.length === 0 ? "console.noModels" : "console.noMatches")}</p>
      ) : (
        <ul className="divide-y divide-border/30">
          {filtered.map((model) => {
            const context = formatTokens(model.contextWindow);
            const output = formatTokens(model.maxTokens);
            return (
              <li key={model.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px] text-foreground">{model.id}</span>
                  {model.displayName && model.displayName !== model.id ? (
                    <span className="block truncate text-[11px] text-muted-foreground">{model.displayName}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground">
                  <ModelCapabilityBadges model={model} />
                  {model.reasoning ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{t("console.reasoning")}</span> : null}
                  {context ? <span className="rounded bg-muted/60 px-1.5 py-0.5">{t("console.context", { value: context })}</span> : null}
                  {output ? <span className="rounded bg-muted/60 px-1.5 py-0.5">{t("console.output", { value: output })}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
