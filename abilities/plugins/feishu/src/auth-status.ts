export interface FeishuUserIdentity {
  openId: string;
  userName: string | null;
  tokenStatus: string | null;
  scopeCount: number;
}

interface AuthStatusUser {
  status?: unknown;
  available?: unknown;
  openId?: unknown;
  userName?: unknown;
  tokenStatus?: unknown;
  scope?: unknown;
}

interface AuthStatusPayload {
  data?: unknown;
  identities?: { user?: AuthStatusUser };
}

function parseJsonObject(output: string): AuthStatusPayload | null {
  const start = output.indexOf("{");
  if (start < 0) return null;
  try {
    const parsed: unknown = JSON.parse(output.slice(start));
    return parsed && typeof parsed === "object" ? parsed as AuthStatusPayload : null;
  } catch {
    return null;
  }
}

function unwrapPayload(payload: AuthStatusPayload): AuthStatusPayload {
  return payload.data && typeof payload.data === "object" ? payload.data as AuthStatusPayload : payload;
}

function countScopes(scope: unknown): number {
  if (Array.isArray(scope)) return scope.filter((value) => typeof value === "string" && value.length > 0).length;
  if (typeof scope === "string") return scope.split(/[\s,]+/u).filter(Boolean).length;
  return 0;
}

/** Parse only display-safe identity fields from `lark-cli auth status --json --verify`. */
export function readFeishuUserIdentity(output: string): FeishuUserIdentity | null {
  const parsed = parseJsonObject(output);
  if (!parsed) return null;
  const user = unwrapPayload(parsed).identities?.user;
  if (!user || user.status !== "ready" || user.available === false || user.tokenStatus === "expired") return null;
  if (typeof user.openId !== "string" || user.openId.length === 0) return null;
  return {
    openId: user.openId,
    userName: typeof user.userName === "string" && user.userName.length > 0 ? user.userName : null,
    tokenStatus: typeof user.tokenStatus === "string" && user.tokenStatus.length > 0 ? user.tokenStatus : null,
    scopeCount: countScopes(user.scope)
  };
}
