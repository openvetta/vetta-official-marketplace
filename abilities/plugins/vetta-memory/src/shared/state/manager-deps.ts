import type { PluginAiModelListResult } from "@vetta-org/plugin-sdk";
import type { MemoryServices } from "../../domain/memory-services";

/** What the Memory page needs from the plugin host; injected so the page stays testable. */
export interface MemoryManagerDeps {
    services: MemoryServices;
    listModels(): Promise<PluginAiModelListResult>;
    notify(options: { message: string; error?: unknown }): void;
}
