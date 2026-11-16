import type { ReactNode } from "react";
import type { Tone } from "../../domain/ui-schema";
import { badgeTone } from "../styles/tone-classes";

export function ToneBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
    return <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium ${badgeTone[tone]}`}>{children}</span>;
}
