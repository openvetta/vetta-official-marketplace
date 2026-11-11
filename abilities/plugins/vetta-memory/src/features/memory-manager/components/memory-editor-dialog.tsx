import { useTranslation } from "@vetta-org/plugin-sdk";
import { useState, type ReactElement } from "react";
import { looksSensitive } from "../../../domain/memory-text";
import { MAX_MEMORY_CONTENT, MEMORY_KINDS, type MemoryKind, type MemoryRecord, type MemoryScope } from "../../../domain/memory-types";
import { projectName } from "../../../domain/memory-text";
import { ModalDialog } from "../../../shared/components/modal-dialog";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../../../shared/styles/controls";

export interface MemoryDraft {
    content: string;
    kind: MemoryKind;
    scope: MemoryScope;
    projectKey: string | null;
    pinned: boolean;
}

export function MemoryEditorDialog({
    initial,
    projects,
    onSave,
    onClose,
}: {
    initial: MemoryRecord | null;
    /** Project directories a memory can be tied to. */
    projects: readonly string[];
    onSave: (draft: MemoryDraft) => Promise<void>;
    onClose: () => void;
}): ReactElement {
    const { t } = useTranslation();
    const [content, setContent] = useState(initial?.content ?? "");
    const [kind, setKind] = useState<MemoryKind>(initial?.kind ?? "fact");
    const [projectKey, setProjectKey] = useState<string | null>(initial?.projectKey ?? null);
    const [pinned, setPinned] = useState(initial?.pinned ?? false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!content.trim()) return setError(t("editor.errorEmpty"));
        if (looksSensitive(content)) return setError(t("editor.errorSecret"));
        setSaving(true);
        setError(null);
        try {
            await onSave({ content, kind, scope: projectKey ? "project" : "global", projectKey, pinned });
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
            setSaving(false);
        }
    };

    const options = projectKey && !projects.includes(projectKey) ? [projectKey, ...projects] : projects;

    return (
        <ModalDialog
            title={initial ? t("editor.titleEdit") : t("editor.titleNew")}
            closeLabel={t("common.close")}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
                        {t("common.cancel")}
                    </button>
                    <button type="button" className={PRIMARY_BUTTON} disabled={saving} onClick={() => void submit()}>
                        {t("common.save")}
                    </button>
                </>
            }
        >
            <div className="flex flex-col gap-3.5">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {t("editor.content")}
                    <textarea
                        autoFocus
                        rows={4}
                        maxLength={MAX_MEMORY_CONTENT}
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        className={`${INPUT} resize-none`}
                    />
                    <span className="text-[11px] text-muted-foreground/70">
                        {t("editor.contentHint", { count: content.length, max: MAX_MEMORY_CONTENT })}
                    </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t("editor.kind")}
                        <select value={kind} onChange={(event) => setKind(event.target.value as MemoryKind)} className={INPUT}>
                            {MEMORY_KINDS.map((value) => (
                                <option key={value} value={value}>
                                    {t(`kind.${value}`)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t("editor.scope")}
                        <select
                            value={projectKey ?? ""}
                            onChange={(event) => setProjectKey(event.target.value || null)}
                            className={INPUT}
                        >
                            <option value="">{t("scope.global")}</option>
                            {options.map((key) => (
                                <option key={key} value={key} title={key}>
                                    {t("scope.projectNamed", { name: projectName(key) })}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
                    {t("editor.pinned")}
                </label>
                {error ? (
                    <p role="alert" className="m-0 text-xs text-destructive">
                        {error}
                    </p>
                ) : null}
            </div>
        </ModalDialog>
    );
}
