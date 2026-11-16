import type { InteractionRecord, InteractionRecords } from "../../domain/interaction-store";
import type { GenerativeUiDeps } from "../../shared/state/generative-ui-deps";

/** Everything an interactive block needs, passed down explicitly (no module-level React context under Module Federation). */
export interface ViewEnv {
    deps: GenerativeUiDeps;
    /** False while the tool call is still streaming or failed: controls render but cannot be used. */
    interactive: boolean;
    records: InteractionRecords;
    record(path: string, entry: InteractionRecord): Promise<void>;
}
