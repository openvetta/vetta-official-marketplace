import { useTranslation } from "@vetta-org/plugin-sdk";
import { useState, type FormEvent, type ReactElement } from "react";
import { projectName } from "../../../domain/memory-text";
import type { ScratchItem } from "../../../domain/memory-types";
import { Badge } from "../../../shared/components/badge";
import { EmptyState } from "../../../shared/components/empty-state";
import { IconButton } from "../../../shared/components/icon-button";
import type { MemoryManagerDeps } from "../../../shared/state/manager-deps";
import { INPUT_BASE, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../../../shared/styles/controls";

export function ScratchpadPanel({ deps, items }: { deps: MemoryManagerDeps; items: readonly ScratchItem[] }): ReactElement {
    const { t } = useTranslation();
    const { scratchpad } = deps.services;
    const [text, setText] = useState("");
    const hasDone = items.some((item) => item.done);

    const run = async (work: () => Promise<unknown>) => {
        try {
            await work();
        } catch (error) {
            deps.notify({ message: t("error.save"), error });
        }
    };

    const add = (event: FormEvent) => {
        event.preventDefault();
        if (!text.trim()) return;
        void run(async () => {
            await scratchpad.add(text, null);
            setText("");
        });
    };

    return (
        <section className="flex flex-col gap-3">
            <form onSubmit={add} className="flex gap-2">
                <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={t("scratch.placeholder")}
                    aria-label={t("scratch.placeholder")}
                    className={`${INPUT_BASE} min-w-0 flex-1`}
                />
                <button type="submit" className={PRIMARY_BUTTON} disabled={!text.trim()}>
                    {t("common.add")}
                </button>
                <button type="button" className={SECONDARY_BUTTON} disabled={!hasDone} onClick={() => void run(() => scratchpad.clearDone())}>
                    {t("scratch.clearDone")}
                </button>
            </form>
            {items.length === 0 ? (
                <EmptyState icon="icon-[solar--checklist-minimalistic-linear]" title={t("scratch.empty.title")} hint={t("scratch.empty.hint")} />
            ) : (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
                            <input
                                type="checkbox"
                                checked={item.done}
                                aria-label={item.text}
                                onChange={() => void run(() => scratchpad.setDone(item.id, !item.done))}
                            />
                            <span className={`min-w-0 flex-1 break-words text-sm ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                {item.text}
                            </span>
                            {item.projectKey ? <Badge>{t("scope.projectNamed", { name: projectName(item.projectKey) })}</Badge> : null}
                            <IconButton
                                icon="icon-[solar--trash-bin-minimalistic-linear]"
                                label={t("common.delete")}
                                danger
                                onClick={() => void run(() => scratchpad.remove(item.id))}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
