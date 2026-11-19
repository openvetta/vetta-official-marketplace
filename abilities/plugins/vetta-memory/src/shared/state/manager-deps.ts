import type { MemoryServices } from "../../domain/memory-services";

/** What the Memory page needs from the plugin host; injected so the page stays testable. */
export interface MemoryManagerDeps {
    services: MemoryServices;
    notify(options: { message: string; error?: unknown }): void;
}
