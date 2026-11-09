import type { PluginContext } from "@vetta-org/plugin-sdk";
import type { NetworkRequest } from "./network";

/**
 * Thin adapter over the host's main-process fetch. Keeping it in one place means
 * the provider code never touches `ctx` and stays testable with a fake.
 */
export function createNetworkRequest(ctx: PluginContext): NetworkRequest {
  return async (call) => {
    const timeoutMs = call.timeoutMs ?? 30_000;
    const response = await ctx.network.request<string>({
      url: call.url,
      method: call.method ?? "GET",
      headers: call.headers,
      ...(call.json === undefined ? {} : { body: { type: "json" as const, value: call.json } }),
      responseType: call.responseType ?? "text",
      timeoutMs
    });
    const body = typeof response.body === "string" ? response.body : JSON.stringify(response.body ?? "");
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers ?? {},
      body
    };
  };
}
