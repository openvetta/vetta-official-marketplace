import type { Disposable, PluginContext } from "@vetta-org/plugin-sdk";
import type { MemoryServices } from "../domain/memory-services";
import { createMemoryForgetTool } from "./memory-forget";
import { createMemoryReadTool } from "./memory-read";
import { createMemoryRestoreTool } from "./memory-restore";
import { createMemorySearchTool } from "./memory-search";
import { createMemoryStatusTool } from "./memory-status";
import { createMemoryWriteTool } from "./memory-write";
import { createScratchpadTool } from "./scratchpad";

export function registerTools(ctx: PluginContext, services: MemoryServices): Disposable[] {
    return [
        ctx.agent.registerTool(createMemoryWriteTool(services)),
        ctx.agent.registerTool(createMemoryReadTool(services)),
        ctx.agent.registerTool(createMemorySearchTool(services)),
        ctx.agent.registerTool(createMemoryForgetTool(services)),
        ctx.agent.registerTool(createMemoryRestoreTool(services)),
        ctx.agent.registerTool(createScratchpadTool(services)),
        ctx.agent.registerTool(createMemoryStatusTool(services)),
    ];
}
