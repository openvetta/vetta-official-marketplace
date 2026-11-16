/**
 * Borderless design language: shape comes from soft fills, shadow and whitespace, not lines.
 * Controls sit on a tinted section (`sectionClass`), so they use the page background as their fill.
 * Overrides are merged by the host's `cn` (tailwind-merge), so they win over the host defaults.
 */

export const fieldClass =
    "h-9 w-full rounded-lg border-transparent bg-background px-3 text-sm font-normal text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground/70 hover:border-transparent focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-primary/25 aria-invalid:border-transparent aria-invalid:ring-2 aria-invalid:ring-red-500/40 disabled:opacity-60 md:text-sm dark:bg-background dark:hover:bg-background dark:aria-invalid:border-transparent";

export const textareaClass = `${fieldClass} h-auto min-h-20 resize-y py-2 leading-relaxed`;

/** Host `SelectTrigger` carries its own border and 12px text; these replace both. */
export const selectTriggerClass =
    "data-[size=default]:h-9 w-full rounded-lg border-transparent bg-background px-3 text-sm font-normal shadow-xs hover:bg-background focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-primary/25 data-[state=open]:bg-background aria-invalid:border-transparent aria-invalid:ring-2 aria-invalid:ring-red-500/40";

export const selectContentClass = "border-transparent shadow-lg";
export const selectItemClass = "text-sm";

/** A soft tinted surface that groups content without an outline. */
export const sectionClass = "rounded-2xl bg-muted/60 p-5";
export const panelClass = "rounded-xl bg-muted/50";
