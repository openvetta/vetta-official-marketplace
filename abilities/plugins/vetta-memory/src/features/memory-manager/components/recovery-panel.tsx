import { useTranslation } from "@vetta-org/plugin-sdk";
import type { ReactElement } from "react";
import type { RecoveryEntry } from "../../../domain/memory-types";
import { Badge } from "../../../shared/components/badge";
import { EmptyState } from "../../../shared/components/empty-state";
import { formatDateTime } from "../../../shared/formatters/format-time";
import type { MemoryManagerDeps } from "../../../shared/state/manager-deps";
import { SECONDARY_BUTTON } from "../../../shared/styles/controls";

export function RecoveryPanel({ deps, entries }: { deps: MemoryManagerDeps; entries: readonly RecoveryEntry[] }): ReactElement {
    const { t, locale } = useTranslation();
    const { services, notify } = deps;

    if (entries.length === 0) {
        return <EmptyState icon="icon-[solar--history-linear]" title={t("recovery.empty.title")} hint={t("recovery.empty.hint")} />;
    }
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {entries.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Badge tone={entry.restoredAt ? "neutral" : "warning"}>{t(`recovery.reason.${entry.reason}`)}</Badge>
                        <span className="text-xs text-muted-foreground">
                            {formatDateTime(entry.deletedAt, locale)} · {t("recovery.count", { count: entry.records.length })}
                        </span>
                        <span className="flex-1" />
                        {entry.restoredAt ? <Badge>{t("recovery.restored")}</Badge> : null}
                        <button
                            type="button"
                            className={SECONDARY_BUTTON}
                            disabled={entry.restoredAt !== null}
                            onClick={() =>
                                void services.restore(entry.id).catch((error: unknown) => notify({ message: t("error.restore"), error }))
                            }
                        >
                            {t("recovery.restore")}
                        </button>
                        <button
                            type="button"
                            className={SECONDARY_BUTTON}
                            onClick={() =>
                                void services.recovery.discard(entry.id).catch((error: unknown) => notify({ message: t("error.delete"), error }))
                            }
                        >
                            {t("recovery.discard")}
                        </button>
                    </div>
                    <ul className="m-0 list-none p-0 text-sm text-muted-foreground">
                        {entry.records.slice(0, 5).map((record) => (
                            <li key={record.id} className="truncate">
                                {record.content}
                            </li>
                        ))}
                        {entry.records.length > 5 ? <li>…</li> : null}
                    </ul>
                </li>
            ))}
        </ul>
    );
}
