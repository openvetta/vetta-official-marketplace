export const INPUT_BASE =
    "rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/60";
/** Full-width field. Use INPUT_BASE when the field must size itself (toolbars). */
export const INPUT = `w-full ${INPUT_BASE}`;
export const BUTTON_BASE =
    "inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const PRIMARY_BUTTON = `${BUTTON_BASE} bg-primary text-primary-foreground hover:opacity-90`;
export const SECONDARY_BUTTON = `${BUTTON_BASE} border border-border bg-card text-foreground hover:bg-muted`;
export const DANGER_BUTTON = `${BUTTON_BASE} border border-destructive/40 text-destructive hover:bg-destructive/10`;
