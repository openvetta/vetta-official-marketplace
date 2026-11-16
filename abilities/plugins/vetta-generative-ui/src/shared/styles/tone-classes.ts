import type { Tone } from "../../domain/ui-schema";

export const badgeTone: Record<Tone, string> = {
    neutral: "bg-muted text-muted-foreground",
    info: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
    danger: "bg-red-500/12 text-red-700 dark:text-red-300",
};

export const alertTone: Record<Tone, { box: string; icon: string }> = {
    neutral: { box: "bg-muted/60", icon: "icon-[solar--info-circle-linear] text-muted-foreground" },
    info: { box: "bg-sky-500/10", icon: "icon-[solar--info-circle-linear] text-sky-600 dark:text-sky-400" },
    success: { box: "bg-emerald-500/10", icon: "icon-[solar--check-circle-linear] text-emerald-600 dark:text-emerald-400" },
    warning: { box: "bg-amber-500/12", icon: "icon-[solar--danger-triangle-linear] text-amber-600 dark:text-amber-400" },
    danger: { box: "bg-red-500/10", icon: "icon-[solar--close-circle-linear] text-red-600 dark:text-red-400" },
};

export const barTone: Record<Tone, string> = {
    neutral: "bg-primary",
    info: "bg-sky-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
};
