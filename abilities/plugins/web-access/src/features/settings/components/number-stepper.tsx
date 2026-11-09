import { useId } from "react";

interface NumberStepperProps {
  label: string;
  hint?: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(value: number): void;
}

export function NumberStepper({ label, hint, unit, value, min, max, step = 1, onChange }: NumberStepperProps) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, Number.isFinite(next) ? next : min));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-border/70 bg-background">
            <button
              type="button"
              aria-label={`${label} −`}
              disabled={value <= min}
              onClick={() => onChange(clamp(value - step))}
              className="flex h-7 w-7 items-center justify-center rounded-l-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            >
              −
            </button>
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(event) => onChange(clamp(Number(event.target.value)))}
              className="w-14 border-x border-border/70 bg-transparent py-1 text-center text-xs tabular-nums text-foreground outline-none [appearance:textfield] focus:bg-muted/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label={`${label} +`}
              disabled={value >= max}
              onClick={() => onChange(clamp(value + step))}
              className="flex h-7 w-7 items-center justify-center rounded-r-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            >
              +
            </button>
          </div>
          {unit ? <span className="text-[11px] text-muted-foreground">{unit}</span> : null}
        </div>
      </div>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
