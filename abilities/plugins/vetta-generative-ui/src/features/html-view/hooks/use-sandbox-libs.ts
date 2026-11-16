import { useEffect, useState } from "react";
import type { SandboxLib, SandboxLibSources } from "../../../domain/html-document";
import { loadSandboxLibs } from "../../../domain/sandbox/lib-loaders";

/** Resolves the requested built-in libraries; `null` while loading so the iframe is not mounted twice. */
export function useSandboxLibs(libs: readonly SandboxLib[] | undefined, onError: (error: unknown) => void): SandboxLibSources | null {
    const key = [...new Set(libs ?? [])].sort().join(",");
    const [loaded, setLoaded] = useState<{ key: string; sources: SandboxLibSources } | null>(key === "" ? { key, sources: {} } : null);
    useEffect(() => {
        if (key === "") return;
        let cancelled = false;
        loadSandboxLibs(key.split(",") as SandboxLib[])
            .then((sources) => !cancelled && setLoaded({ key, sources }))
            .catch((error: unknown) => {
                onError(error);
                if (!cancelled) setLoaded({ key, sources: {} });
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return loaded?.key === key ? loaded.sources : null;
}
