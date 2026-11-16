import { type RefObject, useEffect, useState } from "react";
import { FALLBACK_PALETTE, type HostPalette } from "../../../domain/html-document";

/**
 * Reads the host theme from probe elements styled with the host's semantic Tailwind classes.
 * Computed colours are concrete (rgb/oklch), so they can cross into the sandboxed document,
 * which has no access to the host's CSS variables.
 */
export function readPalette(probe: HTMLElement | null): HostPalette {
    if (!probe) return FALLBACK_PALETTE;
    const pick = (role: string, property: "color" | "backgroundColor" | "borderTopColor") => {
        const element = probe.querySelector<HTMLElement>(`[data-probe="${role}"]`);
        const value = element ? getComputedStyle(element)[property] : "";
        return value && value !== "rgba(0, 0, 0, 0)" ? value : undefined;
    };
    const root = document.documentElement;
    const dark = root.classList.contains("dark") || getComputedStyle(root).colorScheme.includes("dark");
    return {
        background: pick("background", "backgroundColor") ?? FALLBACK_PALETTE.background,
        foreground: pick("foreground", "color") ?? FALLBACK_PALETTE.foreground,
        muted: pick("muted", "color") ?? FALLBACK_PALETTE.muted,
        border: pick("border", "borderTopColor") ?? FALLBACK_PALETTE.border,
        primary: pick("primary", "backgroundColor") ?? FALLBACK_PALETTE.primary,
        primaryForeground: pick("primary", "color") ?? FALLBACK_PALETTE.primaryForeground,
        fontFamily: getComputedStyle(probe).fontFamily || FALLBACK_PALETTE.fontFamily,
        colorScheme: dark ? "dark" : "light",
    };
}

/** Current host palette; follows theme switches (class/style changes on <html>). */
export function useHostPalette(probeRef: RefObject<HTMLElement | null>): HostPalette | null {
    const [palette, setPalette] = useState<HostPalette | null>(null);
    useEffect(() => {
        const update = () =>
            setPalette((current) => {
                const next = readPalette(probeRef.current);
                return current && JSON.stringify(current) === JSON.stringify(next) ? current : next;
            });
        update();
        const observer = new MutationObserver(update);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
        return () => observer.disconnect();
    }, [probeRef]);
    return palette;
}
