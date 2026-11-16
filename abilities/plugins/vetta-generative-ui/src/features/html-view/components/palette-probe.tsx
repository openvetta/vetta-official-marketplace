import type { Ref } from "react";

/** Invisible elements carrying the host's semantic classes; their computed colours become the sandbox theme. */
export function PaletteProbe({ probeRef }: { probeRef: Ref<HTMLDivElement> }) {
    return (
        <div ref={probeRef} aria-hidden="true" className="pointer-events-none invisible absolute size-0 overflow-hidden">
            <span data-probe="background" className="bg-card" />
            <span data-probe="foreground" className="text-foreground" />
            <span data-probe="muted" className="text-muted-foreground" />
            <span data-probe="border" className="border border-border" />
            <span data-probe="primary" className="bg-primary text-primary-foreground" />
        </div>
    );
}
