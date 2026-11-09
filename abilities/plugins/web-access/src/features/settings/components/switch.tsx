interface SwitchProps {
  checked: boolean;
  label: string;
  onChange(value: boolean): void;
}

/** A bare on/off control; the row that owns it supplies the visible label. */
export function Switch({ checked, label, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted-foreground/25"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
