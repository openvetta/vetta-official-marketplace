import type { Tone } from "../../../domain/ui-schema";
import { barTone } from "../../../shared/styles/tone-classes";

export function ProgressBlock({ label, value, max = 100, tone = "neutral" }: { label?: string; value: number; max?: number; tone?: Tone }) {
    const percent = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="text-foreground">{label}</span>
                <span className="text-muted-foreground tabular-nums">{Math.round(percent)}%</span>
            </div>
            <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full transition-[width] duration-500 ${barTone[tone]}`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}
