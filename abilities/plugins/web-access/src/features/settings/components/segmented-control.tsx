interface SegmentedControlProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange(value: string): void;
  ariaLabel: string;
}

/** Three or fewer exclusive choices fit better as one row than as a select. */
export function SegmentedControl({ value, options, onChange, ariaLabel }: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex w-full rounded-xl border border-border/60 bg-muted/40 p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-[10px] px-3 py-1.5 text-[11px] font-medium transition-all ${
              selected
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
