import { Slider } from "@vetta-org/ui";

interface SliderInputProps {
    id: string;
    value: number;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
    describedBy?: string;
    onChange(value: number): void;
}

export function SliderInput({ id, value, min, max, step, disabled, onChange }: SliderInputProps) {
    return (
        <div id={id} className="flex items-center gap-4">
            <Slider value={[value]} min={min} max={max} step={step} disabled={disabled} aria-label={id} onValueChange={(next) => onChange(next[0] ?? min)} />
            <output className="min-w-12 rounded-md bg-background px-2 py-1 text-center text-xs font-medium tabular-nums text-foreground shadow-xs">{value}</output>
        </div>
    );
}
