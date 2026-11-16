interface CheckboxInputProps {
    id: string;
    label: string;
    checked: boolean;
    disabled?: boolean;
    onChange(checked: boolean): void;
}

export function CheckboxInput({ id, label, checked, disabled, onChange }: CheckboxInputProps) {
    return (
        <div className="flex items-center gap-2.5">
            <button
                id={id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={disabled}
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-[6px] transition focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                    checked ? "bg-primary text-primary-foreground" : "bg-background shadow-xs hover:bg-background/70"
                }`}
                onClick={() => onChange(!checked)}
            >
                {checked ? <span aria-hidden="true" className="icon-[solar--check-read-linear] size-3.5" /> : null}
            </button>
            <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
                {label}
            </label>
        </div>
    );
}
