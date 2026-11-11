import { useTranslation } from "@vetta-org/plugin-sdk";
import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { dateKey, projectName } from "../../../domain/memory-text";
import type { DailyEntry } from "../../../domain/memory-types";
import { Badge } from "../../../shared/components/badge";
import { EmptyState } from "../../../shared/components/empty-state";
import { IconButton } from "../../../shared/components/icon-button";
import { formatClock, formatDateKey } from "../../../shared/formatters/format-time";
import type { MemoryManagerDeps } from "../../../shared/state/manager-deps";
import { INPUT_BASE, PRIMARY_BUTTON } from "../../../shared/styles/controls";

export function DailyPanel({ deps, revision }: { deps: MemoryManagerDeps; revision: number }): ReactElement {
    const { t, locale } = useTranslation();
    const { daily } = deps.services;
    const [dates, setDates] = useState<string[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [entries, setEntries] = useState<DailyEntry[]>([]);
    const [note, setNote] = useState("");
    const today = dateKey(Date.now());

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const list = await daily.listDates();
                const current = selected && (list.includes(selected) || selected === today) ? selected : (list[0] ?? today);
                const day = await daily.readDay(current);
                if (cancelled) return;
                setDates(list);
                setSelected(current);
                setEntries(day);
            } catch (error) {
                if (!cancelled) deps.notify({ message: t("error.load"), error });
            }
        })();
        return () => {
            cancelled = true;
        };
        // `revision` re-runs this when any log changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [daily, revision, selected, today]);

    const add = (event: FormEvent) => {
        event.preventDefault();
        if (!note.trim()) return;
        daily.append(note, { kind: "note" }).then(
            () => {
                setNote("");
                setSelected(today);
            },
            (error: unknown) => deps.notify({ message: t("error.save"), error }),
        );
    };

    const dayList = dates.includes(today) ? dates : [today, ...dates];

    return (
        <section className="flex flex-col gap-3">
            <form onSubmit={add} className="flex gap-2">
                <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("daily.addPlaceholder")}
                    aria-label={t("daily.addPlaceholder")}
                    className={`${INPUT_BASE} min-w-0 flex-1`}
                />
                <button type="submit" className={PRIMARY_BUTTON} disabled={!note.trim()}>
                    {t("common.add")}
                </button>
            </form>
            <div className="flex gap-4">
                <nav aria-label={t("tab.daily")} className="flex w-36 shrink-0 flex-col gap-0.5">
                    {dayList.map((date) => (
                        <button
                            key={date}
                            type="button"
                            aria-current={date === selected}
                            onClick={() => setSelected(date)}
                            className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                                date === selected ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60"
                            }`}
                        >
                            {date === today ? `${date} · ${t("daily.today")}` : date}
                        </button>
                    ))}
                </nav>
                <div className="min-w-0 flex-1">
                    {selected ? <h3 className="m-0 mb-2 px-1 py-1.5 text-xs font-medium text-muted-foreground">{formatDateKey(selected, locale)}</h3> : null}
                    {entries.length === 0 ? (
                        <EmptyState icon="icon-[solar--calendar-linear]" title={t("daily.empty.title")} hint={t("daily.empty.hint")} />
                    ) : (
                        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                            {entries.map((entry) => (
                                <li key={entry.id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
                                    <span className="mt-0.5 w-11 shrink-0 text-xs tabular-nums text-muted-foreground">{formatClock(entry.at, locale)}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.text}</p>
                                        <div className="mt-1 flex gap-1.5">
                                            {entry.kind !== "note" ? <Badge tone="accent">{t(`daily.kind.${entry.kind}`)}</Badge> : null}
                                            {entry.cwd ? <Badge>{projectName(entry.cwd)}</Badge> : null}
                                        </div>
                                    </div>
                                    <IconButton
                                        icon="icon-[solar--trash-bin-minimalistic-linear]"
                                        label={t("common.delete")}
                                        danger
                                        onClick={() =>
                                            void daily
                                                .removeEntry(selected ?? today, entry.id)
                                                .catch((error: unknown) => deps.notify({ message: t("error.delete"), error }))
                                        }
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}
