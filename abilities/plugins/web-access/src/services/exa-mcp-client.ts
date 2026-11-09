import { headerValue, parseBody, type NetworkRequest } from "./network";

/**
 * Exa publishes a keyless MCP endpoint. It is the default because a new user can
 * search the web before configuring anything; the same endpoint also reads pages
 * that the direct fetcher cannot reach, including PDFs.
 */
export const EXA_MCP_ENDPOINT = "https://mcp.exa.ai/mcp";
const PROTOCOL_VERSION = "2024-11-05";
const SESSION_TTL_MS = 10 * 60_000;

interface McpSession {
  id: string;
  expiresAt: number;
}

let session: McpSession | null = null;

const headers = (id?: string): Record<string, string> => ({
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  ...(id ? { "mcp-session-id": id } : {})
});

async function openSession(call: NetworkRequest): Promise<string> {
  const response = await call({
    url: EXA_MCP_ENDPOINT,
    method: "POST",
    headers: headers(),
    json: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vetta-web-access", version: "1.0.0" }
      }
    },
    responseType: "text",
    timeoutMs: 30_000
  });
  if (!response.ok) {
    throw new Error(`Free Exa search could not start a session (HTTP ${response.status} ${response.statusText}).`);
  }
  const id = headerValue(response.headers, "mcp-session-id").trim();
  if (!id) throw new Error("Free Exa search did not return a session id.");
  session = { id, expiresAt: Date.now() + SESSION_TTL_MS };
  return id;
}

/** Reads the first JSON-RPC payload out of a streamable-HTTP response (SSE or plain JSON). */
export function readJsonRpcPayload(body: string): unknown {
  const trimmed = body.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("{")) return parseBody(trimmed);

  const payloads: unknown[] = [];
  for (const event of trimmed.split(/\r?\n\r?\n/u)) {
    const data = event
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    const parsed = parseBody(data);
    if (parsed !== undefined) payloads.push(parsed);
  }
  // A stream may carry notifications before the reply; take the one that is a
  // JSON-RPC result or error, not merely the first parsable event.
  return (
    payloads.find((payload) => {
      if (typeof payload !== "object" || payload === null) return false;
      return "result" in payload || "error" in payload;
    }) ?? payloads[0]
  );
}

function unwrapToolText(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) throw new Error("Free Exa search returned an unreadable response.");
  const record = payload as Record<string, unknown>;
  const error = record.error as Record<string, unknown> | undefined;
  if (error && typeof error === "object") {
    const message = typeof error.message === "string" ? error.message : "unknown error";
    throw new Error(`Free Exa search failed: ${message}`);
  }
  const result = record.result as Record<string, unknown> | undefined;
  if (!result) throw new Error("Free Exa search returned no result.");
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content
    .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>).text : undefined))
    .filter((value): value is string => typeof value === "string")
    .join("\n\n")
    .trim();
  if (result.isError === true) throw new Error(`Free Exa search failed: ${text || "unknown error"}`);
  if (!text) throw new Error("Free Exa search returned an empty answer.");
  return text;
}

async function callTool(call: NetworkRequest, name: string, args: Record<string, unknown>, timeoutMs: number): Promise<string> {
  const send = async (id: string) => {
    const response = await call({
      url: EXA_MCP_ENDPOINT,
      method: "POST",
      headers: headers(id),
      json: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } },
      responseType: "text",
      timeoutMs
    });
    if (!response.ok) {
      const error = new Error(`Free Exa ${name} returned HTTP ${response.status} ${response.statusText}.`) as Error & {
        retryableSession?: boolean;
      };
      error.retryableSession = response.status === 400 || response.status === 404;
      throw error;
    }
    return unwrapToolText(readJsonRpcPayload(response.body));
  };

  const id = session && session.expiresAt > Date.now() ? session.id : await openSession(call);
  try {
    return await send(id);
  } catch (error) {
    const retryable = (error as Error & { retryableSession?: boolean }).retryableSession === true;
    if (!retryable) throw error;
    session = null;
    return send(await openSession(call));
  }
}

export async function exaMcpSearch(call: NetworkRequest, query: string, count: number, objective: string): Promise<string> {
  return callTool(call, "web_search_exa", { query, numResults: count, objective }, 60_000);
}

export async function exaMcpFetch(call: NetworkRequest, url: string, maxCharacters: number): Promise<string> {
  return callTool(call, "web_fetch_exa", { urls: [url], maxCharacters }, 60_000);
}
