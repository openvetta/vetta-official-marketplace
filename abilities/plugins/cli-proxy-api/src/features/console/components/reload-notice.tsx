import { useTranslation } from "@vetta-org/plugin-sdk";
import { type ReactElement } from "react";

/**
 * Says the part the model picker cannot say for itself.
 *
 * Publishing a provider updates the settings on disk, but the running window
 * keeps the model list it read at startup — so a user who just synced goes
 * looking for the models and does not find them. The gateway syncs on its own
 * whenever the service comes up, which is exactly when nobody pressed a button
 * to explain the gap, so this states it at all times and only sharpens after a
 * sync the user asked for.
 */
export function ReloadNotice({ syncedModelCount }: { syncedModelCount: number | null }): ReactElement {
  const { t } = useTranslation();
  const synced = syncedModelCount !== null;
  return (
    <div
      role={synced ? "status" : undefined}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 ${synced ? "border-emerald-500/25 bg-emerald-500/10" : "border-border/50 bg-muted/25"}`}
    >
      <span className={`shrink-0 ${synced ? "text-emerald-400" : "text-muted-foreground"}`} aria-hidden="true">ⓘ</span>
      <p className={`min-w-0 flex-1 text-xs leading-relaxed ${synced ? "text-emerald-400" : "text-muted-foreground"}`}>
        {synced ? t("console.reloadNoticeSynced", { count: syncedModelCount }) : t("console.reloadNotice")}
      </p>
    </div>
  );
}
