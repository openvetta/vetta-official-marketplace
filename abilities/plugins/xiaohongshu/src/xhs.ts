import type { PluginContext } from "@vetta-org/plugin-sdk";
import type { ManagedPluginContext, ManagedServiceApi } from "./runtime-contract";

export const SERVICE_ID = "xhs";
const SESSION_FILE = "cookies.json";
const ACCOUNTS_FILE = "accounts.json";
const SESSION_SECRET_PREFIX = "session:";

export type AccountStatus = "connected" | "expired" | "unknown";

export interface XhsAccount {
  id: string;
  name: string;
  createdAt: string;
  lastCheckedAt?: string;
  status: AccountStatus;
}

interface AccountState {
  schemaVersion: 1;
  activeAccountId?: string;
  accounts: XhsAccount[];
}

/**
 * Plugin API 2.0 exposes storage as explicit file/encoding primitives.  Keep
 * the cast local so the plugin can still be built with the currently cached
 * SDK package while the host bridge is being updated in lockstep.
 */
type FileStorage = {
  readFile(path: string, encoding?: "utf8" | "base64"): Promise<string | null>;
  writeFile(path: string, data: string, encoding?: "utf8" | "base64"): Promise<unknown>;
};

export interface LoginStatus {
  loggedIn: boolean;
  nickname?: string;
}

function services(ctx: PluginContext): ManagedServiceApi {
  return (ctx as ManagedPluginContext).services;
}

function accountKey(id: string): string {
  return `${SESSION_SECRET_PREFIX}${id}`;
}

function newId(): string {
  return `account-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function readAccountState(ctx: PluginContext): Promise<AccountState> {
  const raw = await (ctx.storage as unknown as FileStorage).readFile(ACCOUNTS_FILE, "utf8");
  const parsed = raw ? JSON.parse(raw) as Partial<AccountState> : null;
  if (!parsed) return { schemaVersion: 1, accounts: [] };
  try {
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.accounts)) throw new Error("invalid account state");
    return {
      schemaVersion: 1,
      activeAccountId: typeof parsed.activeAccountId === "string" ? parsed.activeAccountId : undefined,
      accounts: parsed.accounts.filter((account): account is XhsAccount => Boolean(
        account && typeof account === "object" && typeof account.id === "string" && typeof account.name === "string",
      )),
    };
  } catch {
    return { schemaVersion: 1, accounts: [] };
  }
}

async function writeAccountState(ctx: PluginContext, state: AccountState): Promise<void> {
  await (ctx.storage as unknown as FileStorage).writeFile(ACCOUNTS_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function readSession(ctx: PluginContext, accountId: string): Promise<string | undefined> {
  return (await (ctx as ManagedPluginContext).secrets.get(accountKey(accountId))) ?? undefined;
}

async function saveSession(ctx: PluginContext, accountId: string, session: string): Promise<void> {
  await (ctx as ManagedPluginContext).secrets.set(accountKey(accountId), session);
}

export async function loginStatus(ctx: PluginContext): Promise<LoginStatus> {
  const response = await services(ctx).request<unknown>(SERVICE_ID, {
    path: "/api/v1/login/status",
    responseType: "json",
    timeoutMs: 10_000,
  });
  if (!response.ok) throw new Error(`Login status failed: HTTP ${response.status}`);
  const body = response.body as Record<string, unknown>;
  const data = body?.data as Record<string, unknown> | undefined;
  return {
    loggedIn: data?.is_logged_in === true,
    nickname: typeof data?.nickname === "string" ? data.nickname : undefined,
  };
}

export async function requestQrPayload(ctx: PluginContext): Promise<string> {
  const response = await services(ctx).request<unknown>(SERVICE_ID, {
    path: "/api/v1/login/qrcode",
    responseType: "json",
    timeoutMs: 30_000,
  });
  if (!response.ok) throw new Error(`QR request failed: HTTP ${response.status}`);
  const body = response.body as Record<string, unknown>;
  const data = body?.data as Record<string, unknown> | undefined;
  const candidates = [data?.url, data?.qrcode, data?.qr_code, body?.url, body?.qrcode, body?.qr_code];
  const payload = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (!payload) throw new Error("QR response did not contain a URL");
  return payload;
}

export async function captureCurrentSession(ctx: PluginContext): Promise<string> {
  const session = await services(ctx).readDataFile(SERVICE_ID, SESSION_FILE, "utf8");
  if (!session) throw new Error("The service did not produce a session file");
  JSON.parse(session) as unknown;
  return session;
}

export async function beginLogin(ctx: PluginContext): Promise<XhsAccount> {
  const state = await readAccountState(ctx);
  const account: XhsAccount = {
    id: newId(),
    name: `小红书账号 ${state.accounts.length + 1}`,
    createdAt: new Date().toISOString(),
    status: "unknown",
  };
  return account;
}

export async function persistLoggedInAccount(ctx: PluginContext, account: XhsAccount): Promise<XhsAccount> {
  const session = await captureCurrentSession(ctx);
  await saveSession(ctx, account.id, session);
  const state = await readAccountState(ctx);
  const next = { ...account, status: "connected" as const, lastCheckedAt: new Date().toISOString() };
  await writeAccountState(ctx, {
    schemaVersion: 1,
    activeAccountId: next.id,
    accounts: [...state.accounts.filter((item) => item.id !== next.id), next],
  });
  return next;
}

export async function switchAccount(ctx: PluginContext, accountId: string): Promise<XhsAccount> {
  const state = await readAccountState(ctx);
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) throw new Error("Account not found");
  const session = await readSession(ctx, accountId);
  if (!session) throw new Error("Account session is missing; sign in again");
  const api = services(ctx);
  await api.stop(SERVICE_ID);
  await api.writeDataFile(SERVICE_ID, SESSION_FILE, session, "utf8");
  await api.start(SERVICE_ID);
  const status = await loginStatus(ctx);
  if (!status.loggedIn) throw new Error("The selected account session is no longer valid");
  const next = { ...account, status: "connected" as const, lastCheckedAt: new Date().toISOString() };
  await writeAccountState(ctx, { schemaVersion: 1, activeAccountId: accountId, accounts: state.accounts.map((item) => item.id === accountId ? next : item) });
  return next;
}

export async function removeAccount(ctx: PluginContext, accountId: string): Promise<void> {
  const state = await readAccountState(ctx);
  const nextAccounts = state.accounts.filter((item) => item.id !== accountId);
  await (ctx as ManagedPluginContext).secrets.delete(accountKey(accountId));
  await writeAccountState(ctx, {
    schemaVersion: 1,
    activeAccountId: state.activeAccountId === accountId ? nextAccounts[0]?.id : state.activeAccountId,
    accounts: nextAccounts,
  });
}

export { writeAccountState };
