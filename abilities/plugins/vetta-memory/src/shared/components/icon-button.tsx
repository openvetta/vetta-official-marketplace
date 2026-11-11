import type { ReactElement } from "react";

/** `icon` is a literal Tailwind iconify class such as `icon-[solar--pen-linear]`. */
export function IconButton({
    icon,
    label,
    onClick,
    danger,
    active,
    disabled,
}: {
    icon: string;
    label: string;
    onClick: () => void;
    danger?: boolean;
    active?: boolean;
    disabled?: boolean;
}): ReactElement {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={`flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                danger
                    ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    : active
                      ? "text-primary hover:bg-muted"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
        >
            <span className={`${icon} size-4`} />
        </button>
    );
}
