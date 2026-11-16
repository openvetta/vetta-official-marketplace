import { useCallback, useEffect, useState } from "react";
import type { InteractionRecord, InteractionRecords } from "../../../domain/interaction-store";
import type { GenerativeUiDeps } from "../../../shared/state/generative-ui-deps";

/** Loads and saves what the user already did in one rendered view. */
export function useInteractions(deps: GenerativeUiDeps, toolCallId: string) {
    const [records, setRecords] = useState<InteractionRecords>({});

    useEffect(() => {
        let cancelled = false;
        deps.interactions
            .load(toolCallId)
            .then((loaded) => {
                if (!cancelled) setRecords((current) => ({ ...loaded, ...current }));
            })
            .catch((error: unknown) => deps.notify({ message: "Could not load the view state", error }));
        return () => {
            cancelled = true;
        };
    }, [deps, toolCallId]);

    const record = useCallback(
        async (path: string, entry: InteractionRecord) => {
            setRecords((current) => ({ ...current, [path]: entry }));
            try {
                await deps.interactions.save(toolCallId, path, entry);
            } catch (error) {
                deps.notify({ message: "Could not save the view state", error });
            }
        },
        [deps, toolCallId],
    );

    return { records, record };
}
