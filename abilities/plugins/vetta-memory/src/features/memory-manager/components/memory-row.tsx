import { useTranslation } from "@vetta-org/plugin-sdk";
import type { ReactElement } from "react";
import { projectName } from "../../../domain/memory-text";
import type { MemoryRecord } from "../../../domain/memory-types";
import { Badge } from "../../../shared/components/badge";
import { IconButton } from "../../../shared/components/icon-button";
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
                <IconButton
                    icon={record.pinned ? "icon-[solar--pin-bold]" : "icon-[solar--pin-linear]"}
                    label={record.pinned ? t("memories.unpin") : t("memories.pin")}
                    active={record.pinned}
                    onClick={onTogglePin}
                />
                <IconButton icon="icon-[solar--pen-linear]" label={t("memories.edit")} onClick={onEdit} />
                <IconButton icon="icon-[solar--trash-bin-minimalistic-linear]" label={t("common.delete")} danger onClick={onDelete} />
            </div>
        </li>
    );
}
