export function formatDateTime(timestamp: number, locale: string): string {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

export function formatClock(timestamp: number, locale: string): string {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

/** `2026-11-11` -> a readable date in the user's language. */
export function formatDateKey(date: string, locale: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date(year, month - 1, day));
}
