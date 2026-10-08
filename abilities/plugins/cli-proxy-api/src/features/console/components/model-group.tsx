import { ModelCapabilityBadges } from "./model-capability-badges";
import { useTranslation } from "@vetta-org/plugin-sdk";
import { type ReactElement } from "react";
import { Checkbox } from "../../../shared/components/checkbox";
import { ProviderTag } from "../../../shared/components/provider-tag";
import { Spin } from "../../../shared/components/spin";
import { type ModelRouteKey } from "../../../model-selection";
import { type ProviderPool } from "../../../provider-pools";
import { formatTokens } from "../../../domain/console-format";

/** One supplier pool's effective routes, as tick boxes. */
export function ModelGroup({ pool, settling, selected, onToggle, onGroup }: {
  pool: ProviderPool;
  settling: boolean;
  selected: ReadonlySet<ModelRouteKey>;
  onToggle: (id: ModelRouteKey) => void;
  onGroup: (ids: ModelRouteKey[], next: boolean) => void;
}): ReactElement {
  const { t } = useTranslation();
  const models = pool.models;
  const ids = models.map((model) => model.routeKey);
  const picked = ids.filter((id) => selected.has(id)).length;
  const all = picked === ids.length && ids.length > 0;

  return (
    <section
      className="rounded-xl border border-border/50 bg-card/25"
      aria-label={pool.accounts.length === 1 ? pool.accounts[0]?.displayName : pool.id}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
        <Checkbox
          checked={all}
          disabled={ids.length === 0}
          label={t(all ? "console.clearGroup" : "console.selectGroup", { account: pool.id })}
          onChange={() => onGroup(ids, !all)}
        />
        <ProviderTag>{pool.provider ? t(`provider.short.${pool.provider}`) : pool.id}</ProviderTag>
        <span className="min-w-0 truncate text-xs text-foreground">
          {t("console.poolAccounts", { enabled: pool.enabledAccountCount, total: pool.accounts.length })}
        </span>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {t("console.groupCount", { picked, total: ids.length })}
        </span>
      </header>
      {pool.errors.length > 0 && models.length === 0 ? (
        <p className="px-3 py-2.5 text-[11px] text-destructive" role="alert">
          {t("console.groupFailed", { details: pool.errors[0] })}
        </p>
      ) : models.length === 0 ? (
        <p className="px-3 py-2.5 text-[11px] text-muted-foreground">
          {settling && pool.enabledAccountCount > 0 ? <><Spin /> {t("console.groupSettling")}</> : t("console.groupEmpty")}
        </p>
      ) : (
      <div className="grid gap-x-4 gap-y-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {models.map((model) => {
          const context = formatTokens(model.contextWindow);
          return (
            <label key={model.routeKey} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40">
              <span className="flex h-5 shrink-0 items-center">
                <Checkbox checked={selected.has(model.routeKey)} label={model.id} onChange={() => onToggle(model.routeKey)} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[11px] leading-5 text-foreground [overflow-wrap:anywhere]" title={model.displayName ?? model.id}>
                  {model.id}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <ModelCapabilityBadges model={model} />
                  {model.reasoning ? <span className="shrink-0 rounded bg-primary/10 px-1 text-[10px] text-primary">{t("console.reasoning")}</span> : null}
                  {context ? <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{context}</span> : null}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      )}
    </section>
  );
}
