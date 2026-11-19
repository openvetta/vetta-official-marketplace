import { useTranslation } from "@vetta-org/plugin-sdk";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@vetta-org/ui";
import { useMemo, useState, type ReactElement } from "react";
import { memoriesToMarkdown } from "../../../domain/memory-context";
import { searchMemories } from "../../../domain/memory-search";
import { MEMORY_KINDS, type MemoryKind, type MemoryRecord } from "../../../domain/memory-types";
import { EmptyState } from "../../../shared/components/empty-state";
import type { MemoryManagerDeps } from "../../../shared/state/manager-deps";
import { MemoryEditorDialog, type MemoryDraft } from "./memory-editor-dialog";
import { MemoryRow } from "./memory-row";

export function MemoriesPanel({
    deps,
    memories,
    projects,
}: {
    deps: MemoryManagerDeps;
    memories: readonly MemoryRecord[];
    projects: readonly string[];
}): ReactElement {
    const { t } = useTranslation();
    const { services, notify } = deps;
    const [query, setQuery] = useState("");
    const [kind, setKind] = useState<MemoryKind | "">("");
    const [editing, setEditing] = useState<MemoryRecord | "new" | null>(null);
    const [undo, setUndo] = useState<{ recoveryId: string; text: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const shown = useMemo(
        () => searchMemories(memories, query, { allProjects: true, kind: kind || undefined, limit: 500 }),
        [memories, query, kind],
    );

    const run = async (message: string, work: () => Promise<void>) => {
        try {
            await work();
        } catch (error) {
            notify({ message, error });
        }
    };

    const save = async (draft: MemoryDraft) => {
        if (editing && editing !== "new") {
            await services.memories.update(editing.id, draft);
        } else {
            await services.memories.add({ ...draft, source: "user" });
        }
        setEditing(null);
    };

    const remove = (record: MemoryRecord) =>
        run(t("error.delete"), async () => {
            const { recoveryId } = await services.forget([record.id], "user");
            setUndo(recoveryId ? { recoveryId, text: record.content } : null);
        });

    const undoDelete = () =>
        run(t("error.restore"), async () => {
            if (undo) await services.restore(undo.recoveryId);
            setUndo(null);
        });

    const copyMarkdown = () =>
        run(t("error.copy"), async () => {
            await navigator.clipboard.writeText(memoriesToMarkdown(shown));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });

    return (
        <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("memories.search")}
                    aria-label={t("memories.search")}
                    className="min-w-48 flex-1"
                />
                <Select value={kind || "all"} onValueChange={(value) => setKind(value === "all" ? "" : (value as MemoryKind))}>
                    <SelectTrigger aria-label={t("editor.kind")} className="w-36 shrink-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t("memories.allKinds")}</SelectItem>
                        {MEMORY_KINDS.map((value) => (
                            <SelectItem key={value} value={value}>
                                {t(`kind.${value}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" disabled={shown.length === 0} onClick={() => void copyMarkdown()}>
                    <span className="icon-[solar--copy-linear] size-4" />
                    {copied ? t("common.copied") : t("memories.copyMarkdown")}
                </Button>
                <Button variant="primary" onClick={() => setEditing("new")}>
                    <span className="icon-[solar--add-circle-linear] size-4" />
                    {t("memories.add")}
                </Button>
            </div>

            {undo ? (
                <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-xs">
                    <span className="min-w-0 truncate">{t("memories.deleted", { text: undo.text })}</span>
                    <Button variant="link" size="xs" onClick={() => void undoDelete()}>
                        {t("memories.undo")}
                    </Button>
                </div>
            ) : null}

            {shown.length === 0 ? (
                <EmptyState
                    icon="icon-[solar--brain-linear]"
                    title={memories.length === 0 ? t("memories.empty.title") : t("memories.noMatch")}
                    hint={memories.length === 0 ? t("memories.empty.hint") : undefined}
                />
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {shown.map((record) => (
                        <MemoryRow
                            key={record.id}
                            record={record}
                            onTogglePin={() =>
                                void run(t("error.save"), async () => {
                                    await services.memories.update(record.id, { pinned: !record.pinned });
                                })
                            }
                            onEdit={() => setEditing(record)}
                            onDelete={() => void remove(record)}
                        />
                    ))}
                </ul>
            )}

            {editing ? (
                <MemoryEditorDialog
                    initial={editing === "new" ? null : editing}
                    projects={projects}
                    onSave={save}
                    onClose={() => setEditing(null)}
                />
            ) : null}
        </section>
    );
}
