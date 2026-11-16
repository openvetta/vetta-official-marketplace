import type { Tone } from "../../../domain/ui-schema";
import { alertTone } from "../../../shared/styles/tone-classes";

export function AlertBlock({ tone = "info", title, text }: { tone?: Tone; title?: string; text: string }) {
    const style = alertTone[tone];
    return (
        <div role={tone === "danger" || tone === "warning" ? "alert" : "status"} className={`flex gap-3 rounded-xl px-4 py-3.5 ${style.box}`}>
            <span aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${style.icon}`} />
            <div className="min-w-0 text-sm">
                {title ? <div className="mb-0.5 font-medium text-foreground">{title}</div> : null}
                <div className="whitespace-pre-line text-muted-foreground">{text}</div>
            </div>
        </div>
    );
}
