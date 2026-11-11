import type { ReactElement } from "react";

export function ToggleSwitch({
    checked,
    onChange,
    label,
    disabled,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    disabled?: boolean;
}): ReactElement {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                checked ? "bg-primary" : "bg-muted-foreground/30"
            }`}
        >
            <span
                className={`inline-block size-4 rounded-full bg-background shadow transition-transform ${
                    checked ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
            />
        </button>
    );
}
