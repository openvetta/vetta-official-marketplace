import { ModelPicker, useTranslation } from "@vetta-org/plugin-sdk";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@vetta-org/ui";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { isSnapshotMode, SNAPSHOT_MODES, type MemorySettings } from "../../../domain/memory-types";
import { ConfirmDialog } from "../../../shared/components/confirm-dialog";
import type { MemoryManagerDeps } from "../../../shared/state/manager-deps";

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }): ReactElement {
    return (
        <div className="flex items-center justify-between gap-6 border-b border-border/50 py-3 last:border-b-0">
            <div className="min-w-0">
                <p className="m-0 text-sm font-medium text-foreground">{title}</p>
                {hint ? <p className="m-0 mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function NumberField({
    label,
    value,
    min,
    max,
    onCommit,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    onCommit: (next: number) => void;
}): ReactElement {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);
    return (
        <Input
            type="number"
            aria-label={label}
            min={min}
            max={max}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                const next = Number(draft);
                if (Number.isFinite(next) && next !== value) onCommit(next);
                else setDraft(String(value));
            }}
            className="w-24 text-right"
        />
    );
}

export function SettingsPanel({ deps, settings }: { deps: MemoryManagerDeps; settings: MemorySettings }): ReactElement {
    const { t } = useTranslation();
    const { services, notify } = deps;
    const [confirmClear, setConfirmClear] = useState(false);

    const update = (patch: Partial<MemorySettings>) =>
        void services.memories.updateSettings(patch).catch((error: unknown) => notify({ message: t("error.save"), error }));

    return (
        <section className="flex flex-col">
            <div className="rounded-xl border border-border/60 bg-card px-4">
                <Row title={t("settings.autoExtract")} hint={t("settings.autoExtract.hint")}>
                    <Switch
                        aria-label={t("settings.autoExtract")}
                        checked={settings.autoExtract}
                        onCheckedChange={(autoExtract) => update({ autoExtract })}
                    />
                </Row>
                <Row title={t("settings.sessionSummary")} hint={t("settings.sessionSummary.hint")}>
                    <Switch
                        aria-label={t("settings.sessionSummary")}
                        checked={settings.sessionSummary}
                        onCheckedChange={(sessionSummary) => update({ sessionSummary })}
                    />
                </Row>
                <Row title={t("settings.model")} hint={t("settings.model.hint")}>
                    <ModelPicker
                        value={settings.modelKey}
                        onChange={(modelKey) => update({ modelKey })}
                        emptyOption={{ label: t("settings.modelDefault") }}
                        ariaLabel={t("settings.model")}
                        className="w-56"
                    />
                </Row>
                <Row title={t("settings.snapshotMode")} hint={t(`settings.snapshotMode.${settings.snapshotMode}.hint`)}>
                    <Select
                        value={settings.snapshotMode}
                        onValueChange={(value) => isSnapshotMode(value) && update({ snapshotMode: value })}
                    >
                        <SelectTrigger aria-label={t("settings.snapshotMode")} className="w-56">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SNAPSHOT_MODES.map((mode) => (
                                <SelectItem key={mode} value={mode}>
                                    {t(`settings.snapshotMode.${mode}`)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Row>
                <Row title={t("settings.injectLimit")} hint={t("settings.injectLimit.hint")}>
                    <NumberField label={t("settings.injectLimit")} value={settings.injectLimit} min={1} max={100} onCommit={(injectLimit) => update({ injectLimit })} />
                </Row>
                <Row title={t("settings.injectCharBudget")} hint={t("settings.injectCharBudget.hint")}>
                    <NumberField
                        label={t("settings.injectCharBudget")}
                        value={settings.injectCharBudget}
                        min={200}
                        max={12000}
                        onCommit={(injectCharBudget) => update({ injectCharBudget })}
                    />
                </Row>
            </div>

            <div className="mt-4 flex items-center justify-between gap-6 rounded-xl border border-destructive/30 px-4 py-3">
                <div>
                    <p className="m-0 text-sm font-medium">{t("settings.clearAll")}</p>
                    <p className="m-0 mt-0.5 text-xs text-muted-foreground">{t("settings.clearAll.hint")}</p>
                </div>
                <Button variant="destructive" onClick={() => setConfirmClear(true)}>
                    {t("settings.clearAll")}
                </Button>
            </div>

            {confirmClear ? (
                <ConfirmDialog
                    title={t("settings.clearAll")}
                    message={t("settings.clearAll.confirm")}
                    confirmLabel={t("settings.clearAll")}
                    cancelLabel={t("common.cancel")}
                    closeLabel={t("common.close")}
                    onClose={() => setConfirmClear(false)}
                    onConfirm={() => {
                        setConfirmClear(false);
                        void services.clearAllMemories().catch((error: unknown) => notify({ message: t("error.delete"), error }));
                    }}
                />
            ) : null}
        </section>
    );
}
