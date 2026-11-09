import type { Disposable, PluginContext } from "@vetta-org/plugin-sdk";
import type { NetworkRequest } from "../services/network";
import type { WebAccessStore } from "../services/settings-store";
import { createWebFetchTool } from "./web-fetch";
import { createWebSearchTool } from "./web-search";

export function registerWebAccessTools(ctx: PluginContext, store: WebAccessStore, call: NetworkRequest): Disposable[] {
  return [
    ctx.agent.registerTool(createWebSearchTool(store, call)),
    ctx.agent.registerTool(createWebFetchTool(store, call))
  ];
}
