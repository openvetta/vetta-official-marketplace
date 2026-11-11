import { useEffect, useState, useSyncExternalStore } from "react";
import type { MemoryServices } from "../../../domain/memory-services";

/** Re-renders whenever any store changes; returns the revision as a change token. */
export function useServicesRevision(services: MemoryServices): number {
    return useSyncExternalStore(
        (listener) => services.subscribe(listener),
        () => services.revision,
    );
}

/** Loads the persisted stores once; `error` is the failure message, if any. */
export function useLoadedServices(
    services: MemoryServices,
    onError: (error: unknown) => void,
): { ready: boolean; error: string | null } {
    const [state, setState] = useState<{ ready: boolean; error: string | null }>({ ready: false, error: null });
    useEffect(() => {
        let cancelled = false;
        services.loadAll().then(
            () => !cancelled && setState({ ready: true, error: null }),
            (error: unknown) => {
                if (cancelled) return;
                setState({ ready: false, error: error instanceof Error ? error.message : String(error) });
                onError(error);
            },
        );
        return () => {
            cancelled = true;
        };
    }, [services, onError]);
    return state;
}
