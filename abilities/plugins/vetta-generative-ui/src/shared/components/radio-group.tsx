interface RadioGroupProps {
    id: string;
    label: string;
    value: string;
    options: ReadonlyArray<{ label: string; value: string }>;
    disabled?: boolean;
    onChange(value: string): void;
}

export function RadioGroup({ id, label, value, options, disabled, onChange }: RadioGroupProps) {
    return (
        <div id={id} role="radiogroup" aria-label={label} className="flex flex-col gap-1">
            {options.map((option) => {
                const checked = value === option.value;
                return (
                    <label
                        key={option.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition has-disabled:cursor-not-allowed has-disabled:opacity-60 ${
                            checked ? "bg-background shadow-xs" : "hover:bg-background/60"
                        }`}
                    >
                        <input type="radio" name={id} value={option.value} checked={checked} disabled={disabled} className="peer sr-only" onChange={() => onChange(option.value)} />
                        <span
                            aria-hidden="true"
                            className={`flex size-4 shrink-0 items-center justify-center rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 ${
                                checked ? "bg-primary" : "bg-muted-foreground/25"
                            }`}
                        >
                            {checked ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
                        </span>
                        <span className="text-foreground">{option.label}</span>
                    </label>
                );
            })}
        </div>
    );
}
