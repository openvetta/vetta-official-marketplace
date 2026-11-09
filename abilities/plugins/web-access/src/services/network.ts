export interface NetworkCall {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  json?: unknown;
  responseType?: "json" | "text";
  timeoutMs?: number;
}

export interface NetworkResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

export type NetworkRequest = (call: NetworkCall) => Promise<NetworkResult>;

export interface NetworkErrorDetails {
  status: number;
  statusText: string;
  body: string;
}

export function isNetworkErrorDetails(value: unknown): value is NetworkErrorDetails {
  return typeof value === "object" && value !== null && typeof (value as NetworkErrorDetails).status === "number";
}

export function headerValue(headers: Record<string, string>, name: string): string {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return "";
}

/**
 * The host returns non-2xx responses instead of throwing; callers need the body
 * to tell a bad key apart from a rate limit, but the message shown to the user
 * must stay short and never echo request headers.
 */
export async function expectOk(call: NetworkRequest, request: NetworkCall, providerLabel: string): Promise<NetworkResult> {
  const result = await call(request);
  if (result.ok) return result;

  const reason = describeStatus(result.status);
  const detail = summarizeBody(result.body);
  throw new Error(`${providerLabel} returned HTTP ${result.status} ${result.statusText}${reason ? ` (${reason})` : ""}.${detail ? ` ${detail}` : ""}`);
}

export function describeStatus(status: number): string {
  if (status === 401 || status === 403) return "the key or its permissions were rejected";
  if (status === 402) return "the account is out of quota";
  if (status === 404) return "the endpoint does not exist";
  if (status === 429) return "rate limited";
  if (status >= 500) return "provider error";
  return "";
}

function summarizeBody(body: string): string {
  const trimmed = body.trim().replace(/\s+/gu, " ");
  if (!trimmed) return "";
  return trimmed.length > 240 ? `${trimmed.slice(0, 239)}…` : trimmed;
}

/** Safely reads an error string out of a provider's JSON body. */
export function parseBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

export function errorMessageFromBody(body: string): string {
  const parsed = parseBody(body);
  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    for (const key of ["error", "message", "msg", "detail"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "object" && value !== null) {
        const nested = (value as Record<string, unknown>).message;
        if (typeof nested === "string" && nested.trim()) return nested.trim();
      }
    }
  }
  return summarizeBody(body);
}
