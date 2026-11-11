import { useTranslation } from "@vetta-org/plugin-sdk";
import { useMemo, useState, type ReactElement } from "react";
import { ToggleSwitch } from "../../../shared/components/toggle-switch";
import { TabBar, type TabItem } from "../../../shared/components/tab-bar";
import type { MemoryManagerDeps } from "../../../shared/state/manager-deps";
import { useLoadedServices, useServicesRevision } from "../hooks/use-memory-data";
import { DailyPanel } from "./daily-panel";
import { MemoriesPanel } from "./memories-panel";
import { RecoveryPanel } from "./recovery-panel";
import { ScratchpadPanel } from "./scratchpad-panel";
import { SettingsPanel } from "./settings-panel";

type TabId = "memories" | "daily" | "scratchpad" | "recovery" | "settings";

/** The standalone Memory page (workspace view): browse, edit, recover and configure everything. */
export function MemoryManagerView({ deps }: { deps: MemoryManagerDeps }): ReactElement {
    const { t } = useTranslation();
    const { services, notify } = deps;
    const [tab, setTab] = useState<TabId>("memories");
    const revision = useServicesRevision(services);
    const { ready, error } = useLoadedServices(
        services,
        useMemo(() => (reason: unknown) => notify({ message: t("error.load"), error: reason }), [notify, t]),
    );

    const settings = services.memories.getSettings();
    // `revision` is the change token: lists are re-read from the stores whenever it moves.
    const data = useMemo(
        () => ({
            memories: services.memories.list(),
            scratch: services.scratchpad.list(),
            recovery: services.recovery.list(),
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [services, revision],
    );
    const projects = useMemo(
        () => [
            ...new Set(
                [...data.memories.map((m) => m.projectKey), ...data.scratch.map((s) => s.projectKey)].filter(
                    (key): key is string => key !== null,
                ),
            ),
        ],
        [data],
    );

    const tabs: TabItem<TabId>[] = [
        { id: "memories", label: t("tab.memories"), count: data.memories.length },
        { id: "daily", label: t("tab.daily") },
        { id: "scratchpad", label: t("tab.scratchpad"), count: data.scratch.filter((item) => !item.done).length },
        { id: "recovery", label: t("tab.recovery"), count: data.recovery.filter((entry) => entry.restoredAt === null).length },
        { id: "settings", label: t("tab.settings") },
    ];

    return (
        <div className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
            <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-6 pt-6">
                <header className="mb-4 flex items-start justify-between gap-6">
                    <div>
                        <h1 className="m-0 text-lg font-semibold">{t("view.title")}</h1>
                        <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">{t("view.subtitle")}</p>
                    </div>
                    {ready ? (
                        <label className="flex shrink-0 items-center gap-2 text-sm">
                            {t("view.enabled")}
                            <ToggleSwitch
                                label={t("view.enabled")}
                                checked={settings.enabled}
                                onChange={(enabled) =>
                                    void services.memories
                                        .updateSettings({ enabled })
                                        .catch((reason: unknown) => notify({ message: t("error.save"), error: reason }))
                                }
                            />
                        </label>
                    ) : null}
                </header>
                <TabBar tabs={tabs} active={tab} onChange={setTab} />
                <div className="min-h-0 flex-1 overflow-y-auto py-4">
                    {error ? (
                        <p role="alert" className="m-0 text-sm text-destructive">
                            {t("error.load")}: {error}
                        </p>
                    ) : !ready ? (
                        <p className="m-0 text-sm text-muted-foreground">{t("common.loading")}</p>
                    ) : tab === "memories" ? (
                        <MemoriesPanel deps={deps} memories={data.memories} projects={projects} />
                    ) : tab === "daily" ? (
                        <DailyPanel deps={deps} revision={revision} />
                    ) : tab === "scratchpad" ? (
                        <ScratchpadPanel deps={deps} items={data.scratch} />
                    ) : tab === "recovery" ? (
                        <RecoveryPanel deps={deps} entries={data.recovery} />
                    ) : (
                        <SettingsPanel deps={deps} settings={settings} />
                    )}
                </div>
            </div>
        </div>
    );
}
