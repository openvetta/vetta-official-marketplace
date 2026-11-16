interface ChoiceChipsProps {
    id: string;
    label: string;
    value: string[];
    options: ReadonlyArray<{ label: string; value: string }>;
    disabled?: boolean;
    onChange(value: string[]): void;
}

/** Multi-select as toggle chips: every option stays visible, which suits the short lists a model produces. */
export function ChoiceChips({ id, label, value, options, disabled, onChange }: ChoiceChipsProps) {
    return (
        <div id={id} role="group" aria-label={label} className="flex flex-wrap gap-2">
            {options.map((option) => {
                const selected = value.includes(option.value);
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        disabled={disabled}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm shadow-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            selected ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => onChange(selected ? value.filter((item) => item !== option.value) : [...value, option.value])}
                    >
                        {selected ? <span aria-hidden="true" className="icon-[solar--check-read-linear] size-3.5" /> : null}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
