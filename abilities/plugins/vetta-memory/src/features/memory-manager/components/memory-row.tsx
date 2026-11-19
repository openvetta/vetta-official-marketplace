import { useTranslation } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta-org/ui";
import type { ReactElement } from "react";
import { projectName } from "../../../domain/memory-text";
import type { MemoryRecord } from "../../../domain/memory-types";
import { Badge } from "../../../shared/components/badge";
import { formatDateTime } from "../../../shared/formatters/format-time";

export function MemoryRow({
    record,
    onTogglePin,
    onEdit,
    onDelete,
}: {
    record: MemoryRecord;
    onTogglePin: () => void;
    onEdit: () => void;
    onDelete: () => void;
}): ReactElement {
    const { t, locale } = useTranslation();
    return (
        <li className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
                <p className="m-0 break-words text-sm leading-relaxed text-foreground">{record.content}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="accent">{t(`kind.${record.kind}`)}</Badge>
                    {record.projectKey ? <Badge>{t("scope.projectNamed", { name: projectName(record.projectKey) })}</Badge> : null}
                    {record.source !== "user" ? <Badge>{t(`source.${record.source}`)}</Badge> : null}
                    <span className="text-[11px] text-muted-foreground">{formatDateTime(record.updatedAt, locale)}</span>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    title={record.pinned ? t("memories.unpin") : t("memories.pin")}
                    aria-label={record.pinned ? t("memories.unpin") : t("memories.pin")}
                    aria-pressed={record.pinned}
                    className={record.pinned ? "text-primary hover:text-primary" : undefined}
                    onClick={onTogglePin}
                >
                    <span className={`${record.pinned ? "icon-[solar--pin-bold]" : "icon-[solar--pin-linear]"} size-4`} />
                </Button>
                <Button variant="ghost" size="icon-sm" title={t("memories.edit")} aria-label={t("memories.edit")} onClick={onEdit}>
                    <span className="icon-[solar--pen-linear] size-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    title={t("common.delete")}
                    aria-label={t("common.delete")}
                    className="hover:bg-destructive/10 hover:text-destructive"
                    onClick={onDelete}
                >
                    <span className="icon-[solar--trash-bin-minimalistic-linear] size-4" />
                </Button>
            </div>
        </li>
    );
}
