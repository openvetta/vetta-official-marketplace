import { useTranslation } from "@vetta-org/plugin-sdk";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@vetta-org/ui";
import { useState, type ReactElement } from "react";
import { looksSensitive } from "../../../domain/memory-text";
import { MAX_MEMORY_CONTENT, MEMORY_KINDS, type MemoryKind, type MemoryRecord, type MemoryScope } from "../../../domain/memory-types";
import { projectName } from "../../../domain/memory-text";
import { ModalDialog } from "../../../shared/components/modal-dialog";

export interface MemoryDraft {
    content: string;
    kind: MemoryKind;
    scope: MemoryScope;
    projectKey: string | null;
    pinned: boolean;
}

/** Radix Select cannot carry an empty-string value, so "no project" travels as this sentinel. */
const GLOBAL_SCOPE = "__global__";

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
                    <Button variant="outline" onClick={onClose}>
                        {t("common.cancel")}
                    </Button>
                    <Button variant="primary" disabled={saving} onClick={() => void submit()}>
                        {t("common.save")}
                    </Button>
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
                        className="w-full resize-none rounded-lg border border-border/60 bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring/60"
                    />
                    <span className="text-[11px] text-muted-foreground/70">
                        {t("editor.contentHint", { count: content.length, max: MAX_MEMORY_CONTENT })}
                    </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span>{t("editor.kind")}</span>
                        <Select value={kind} onValueChange={(value) => setKind(value as MemoryKind)}>
                            <SelectTrigger aria-label={t("editor.kind")} className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MEMORY_KINDS.map((value) => (
                                    <SelectItem key={value} value={value}>
                                        {t(`kind.${value}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span>{t("editor.scope")}</span>
                        <Select
                            value={projectKey ?? GLOBAL_SCOPE}
                            onValueChange={(value) => setProjectKey(value === GLOBAL_SCOPE ? null : value)}
                        >
                            <SelectTrigger aria-label={t("editor.scope")} className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={GLOBAL_SCOPE}>{t("scope.global")}</SelectItem>
                                {options.map((key) => (
                                    <SelectItem key={key} value={key}>
                                        {t("scope.projectNamed", { name: projectName(key) })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Switch checked={pinned} onCheckedChange={setPinned} aria-label={t("editor.pinned")} />
                    <span>{t("editor.pinned")}</span>
                </div>
                {error ? (
                    <p role="alert" className="m-0 text-xs text-destructive">
                        {error}
                    </p>
                ) : null}
            </div>
        </ModalDialog>
    );
}
