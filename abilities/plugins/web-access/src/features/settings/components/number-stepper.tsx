import { Button, Input } from "@vetta-org/ui";
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
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              aria-label={`${label} −`}
              disabled={value <= min}
              onClick={() => onChange(clamp(value - step))}
            >
              <span className="text-sm leading-none">−</span>
            </Button>
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(event) => onChange(clamp(Number(event.target.value)))}
              className="w-16 text-center tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              aria-label={`${label} +`}
              disabled={value >= max}
              onClick={() => onChange(clamp(value + step))}
            >
              <span className="text-sm leading-none">+</span>
            </Button>
          </div>
          {unit ? <span className="text-[11px] text-muted-foreground">{unit}</span> : null}
        </div>
      </div>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
