import type { Tone } from "../../../domain/ui-schema";
import { ToneBadge } from "../../../shared/components/tone-badge";

export function BadgesBlock({ items }: { items: Array<{ label: string; tone?: Tone }> }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((item, index) => (
                <ToneBadge key={`${item.label}-${index}`} tone={item.tone}>
                    {item.label}
                </ToneBadge>
            ))}
        </div>
    );
}
