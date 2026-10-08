import { useTranslation } from "@vetta-org/plugin-sdk";
import { useMemo, type ReactElement } from "react";
import { ActionIcon } from "../../../shared/components/action-icon";
import { Button } from "../../../shared/components/button";
import { Spin } from "../../../shared/components/spin";
import { type ModelRouteKey } from "../../../model-selection";
import { type ProxyAccount } from "../../../proxy-client";
import { buildProviderPools } from "../../../provider-pools";
import { type ModelGroupState } from "../../../domain/model-group-state";
import { ModelGroup } from "./model-group";

/**
 * Chooses what the gateway publishes into Vetta.
 *
 * Grouped by supplier because credentials are a routing pool. Account cards
 * remain the health surface; this picker controls each effective route once.
 *
 * Applying replaces the published set outright rather than merging: the ticked
 * boxes are what the picker will contain, which is the only rule that stays
 * predictable once accounts come and go.
 */
export function ModelPicker({
  accounts, accountModels, loading, settling, selected, setSelected, onApply, applying
}: {
  accounts: ProxyAccount[];
  accountModels: ReadonlyMap<string, ModelGroupState>;
  loading: boolean;
  settling: boolean;
  selected: ReadonlySet<ModelRouteKey>;
  setSelected: (next: ReadonlySet<ModelRouteKey>, allMode: boolean) => void;
  onApply: () => void;
  applying: boolean;
}): ReactElement {
  const { t } = useTranslation();
  const pools = useMemo(() => buildProviderPools(accounts, accountModels), [accountModels, accounts]);
  const everyId = useMemo(() => {
    const ids = new Set<ModelRouteKey>();
    for (const pool of pools) for (const model of pool.models) ids.add(model.routeKey);
    return ids;
  }, [pools]);
  const pickedCount = [...everyId].filter((id) => selected.has(id)).length;

  const toggle = (id: ModelRouteKey): void => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next, false);
  };
  const setGroup = (ids: ModelRouteKey[], on: boolean): void => {
    const next = new Set(selected);
    for (const id of ids) if (on) next.add(id); else next.delete(id);
    setSelected(next, false);
  };

  return (
    <section className="space-y-3" aria-labelledby="cpa-models-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p id="cpa-models-title" className="text-sm font-semibold text-foreground">{t("console.pickerTitle")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("console.pickerSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {t("console.selectedCount", { picked: pickedCount, total: everyId.size })}
          </span>
          <Button disabled={everyId.size === 0} onClick={() => setSelected(new Set(everyId), true)}>{t("console.selectAll")}</Button>
          <Button disabled={pickedCount === 0} onClick={() => setSelected(new Set(), false)}>{t("console.clearAll")}</Button>
          <Button
            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            disabled={applying || loading || everyId.size === 0}
            onClick={onApply}
          >
            {applying ? <Spin /> : <ActionIcon name="app-reload" />}{t("console.apply")}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="rounded-xl border border-border/50 px-4 py-6 text-center text-xs text-muted-foreground">
          <Spin /> {t("console.loadingModels")}
        </p>
      ) : (
        <div className="space-y-3">
          {pools.map((pool) => (
            <ModelGroup
              key={pool.id}
              pool={pool}
              settling={settling}
              selected={selected}
              onToggle={toggle}
              onGroup={setGroup}
            />
          ))}
        </div>
      )}
    </section>
  );
}
