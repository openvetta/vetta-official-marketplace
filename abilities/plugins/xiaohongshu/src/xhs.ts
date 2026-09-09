import type { PluginContext } from "@vetta-org/plugin-sdk";
import type {
	ManagedPluginContext,
	ManagedServiceApi,
} from "./runtime-contract";

export const SERVICE_ID = "xhs";
const SESSION_FILE = "cookies.json";
const ACCOUNTS_FILE = "accounts.json";
const SESSION_SECRET_PREFIX = "session:";
let loginSessionId: string | undefined;
let pendingAccountId: string | undefined;

export type AccountStatus = "connected" | "expired" | "unknown";

export interface XhsAccount {
	id: string;
	name: string;
	/** Upstream nickname, when the service can identify the signed-in user. */
	nickname?: string;
	/** Stable upstream user id; kept for disambiguating accounts, not shown as a secret. */
	userId?: string;
	/** Upstream profile avatar URL, when available. */
	avatarUrl?: string;
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
	writeFile(
		path: string,
		data: string,
		encoding?: "utf8" | "base64",
	): Promise<unknown>;
};

export interface LoginStatus {
	loggedIn: boolean;
	nickname?: string;
	userId?: string;
	avatarUrl?: string;
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

function recordOf(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: undefined;
}

function nonEmptyString(
	record: Record<string, unknown> | undefined,
	keys: readonly string[],
): string | undefined {
	for (const key of keys) {
		const value = record?.[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function errorMessageFromResponse(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim()) return value.trim();
	const record = recordOf(value);
	if (!record) return undefined;
	for (const key of ["error", "message", "detail"]) {
		const message = record[key];
		if (typeof message === "string" && message.trim()) return message.trim();
	}
	return undefined;
}

export function identityFromProfile(
	value: unknown,
): Omit<LoginStatus, "loggedIn"> {
	const root = recordOf(value);
	const firstData = recordOf(root?.data);
	const secondData = recordOf(firstData?.data);
	const candidates = [
		root,
		firstData,
		secondData,
		recordOf(root?.basicInfo),
		recordOf(firstData?.basicInfo),
		recordOf(secondData?.basicInfo),
	];
	return {
		nickname: candidates
			.map((candidate) =>
				nonEmptyString(candidate, ["nickname", "username", "nick_name"]),
			)
			.find(Boolean),
		userId: candidates
			.map((candidate) =>
				nonEmptyString(candidate, ["user_id", "userId", "red_id", "redId"]),
			)
			.find(Boolean),
		avatarUrl: candidates
			.map((candidate) =>
				nonEmptyString(candidate, ["avatarUrl", "avatar_url", "avatar", "image", "images"]),
			)
			.find(Boolean),
	};
}

async function currentProfileIdentity(
	ctx: PluginContext,
): Promise<Omit<LoginStatus, "loggedIn">> {
	try {
		const response = await services(ctx).request<unknown>(SERVICE_ID, {
			path: "/api/v1/user/me",
			responseType: "json",
			timeoutMs: 30_000,
		});
		return response.ok ? identityFromProfile(response.body) : {};
	} catch {
		// Profile identity enriches the account card; it must not downgrade a valid
		// login when the upstream browser page is temporarily slow or unavailable.
		return {};
	}
}

export async function readAccountState(
	ctx: PluginContext,
): Promise<AccountState> {
	const raw = await (ctx.storage as unknown as FileStorage).readFile(
		ACCOUNTS_FILE,
		"utf8",
	);
	const parsed = raw ? (JSON.parse(raw) as Partial<AccountState>) : null;
	if (!parsed) return { schemaVersion: 1, accounts: [] };
	try {
		if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.accounts))
			throw new Error("invalid account state");
		return {
			schemaVersion: 1,
			activeAccountId:
				typeof parsed.activeAccountId === "string"
					? parsed.activeAccountId
					: undefined,
			accounts: parsed.accounts.filter((account): account is XhsAccount =>
				Boolean(
					account &&
						typeof account === "object" &&
						typeof account.id === "string" &&
						typeof account.name === "string",
				),
			),
		};
	} catch {
		return { schemaVersion: 1, accounts: [] };
	}
}

async function writeAccountState(
	ctx: PluginContext,
	state: AccountState,
): Promise<void> {
	await (ctx.storage as unknown as FileStorage).writeFile(
		ACCOUNTS_FILE,
		JSON.stringify(state, null, 2),
		"utf8",
	);
}

export async function readSession(
	ctx: PluginContext,
	accountId: string,
): Promise<string | undefined> {
	return (
		(await (ctx as ManagedPluginContext).secrets.get(accountKey(accountId))) ??
		undefined
	);
}

async function saveSession(
	ctx: PluginContext,
	accountId: string,
	session: string,
): Promise<void> {
	await (ctx as ManagedPluginContext).secrets.set(
		accountKey(accountId),
		session,
	);
}

export async function loginStatus(ctx: PluginContext): Promise<LoginStatus> {
	if (loginSessionId) {
		const session = await services(ctx).request<unknown>(SERVICE_ID, {
			path: `/api/v1/login/sessions/${loginSessionId}`,
			responseType: "json",
			timeoutMs: 10_000,
		});
		if (session.ok) {
			const value = session.body as Record<string, unknown>;
			if (value.status === "waiting") return { loggedIn: false };
			if (value.status === "authenticated") {
				loginSessionId = undefined;
				const account = value.account as Record<string, unknown> | undefined;
				return {
					loggedIn: true,
					nickname: nonEmptyString(account, ["username", "nickname", "name"]),
					userId: nonEmptyString(account, ["userId", "user_id"]),
					avatarUrl: nonEmptyString(account, ["avatarUrl", "avatar_url", "avatar"]),
				};
			}
		}
	}
	const response = await services(ctx).request<unknown>(SERVICE_ID, {
		path: "/api/v1/login/status",
		responseType: "json",
		timeoutMs: 10_000,
	});
	if (!response.ok)
		throw new Error(`Login status failed: HTTP ${response.status}`);
	const body = response.body as Record<string, unknown>;
	const data = body?.data as Record<string, unknown> | undefined;
	const loggedIn = data?.is_logged_in === true;
	const statusIdentity = identityFromProfile(data);
	if (!loggedIn || statusIdentity.nickname) {
		return { loggedIn, ...statusIdentity };
	}
	const profileIdentity = await currentProfileIdentity(ctx);
	return {
		loggedIn,
		nickname: profileIdentity.nickname,
		userId: statusIdentity.userId ?? profileIdentity.userId,
		avatarUrl: statusIdentity.avatarUrl ?? profileIdentity.avatarUrl,
	};
}

export function accountDisplayName(
	account: Pick<XhsAccount, "name" | "nickname">,
): string | undefined {
	const nickname = account.nickname?.trim();
	const name = account.name.trim();
	const generated =
		/^小红书账号(?:\s*\d+)?$/.test(name) ||
		/^Xiaohongshu account\s*\d+$/i.test(name) ||
		name === "扫码流程验证号";
	if (name && !generated && name !== nickname) return name;
	if (
		nickname &&
		!/^小红书账号(?:\s*\d+)?$/.test(nickname) &&
		!/^Xiaohongshu account\s*\d+$/i.test(nickname)
	)
		return nickname;
	return name && !generated ? name : undefined;
}

export function accountInitial(
	account: Pick<XhsAccount, "name" | "nickname">,
): string {
	return (accountDisplayName(account) ?? "小").trim().slice(0, 1).toUpperCase();
}

/** Persist identity discovered through the managed upstream runtime. */
export async function updateAccountIdentity(
	ctx: PluginContext,
	accountId: string,
	status: LoginStatus,
): Promise<XhsAccount | undefined> {
	const state = await readAccountState(ctx);
	const current = state.accounts.find((item) => item.id === accountId);
	if (!current) return undefined;
	const next: XhsAccount = {
		...current,
		nickname: status.nickname || current.nickname,
		userId: status.userId || current.userId,
		avatarUrl: status.avatarUrl || current.avatarUrl,
		name: current.name,
		status: status.loggedIn ? "connected" : "expired",
		lastCheckedAt: new Date().toISOString(),
	};
	await writeAccountState(ctx, {
		...state,
		accounts: state.accounts.map((item) =>
			item.id === accountId ? next : item,
		),
	});
	return next;
}

export async function requestQrPayload(ctx: PluginContext): Promise<string> {
	const response = await services(ctx).request<unknown>(SERVICE_ID, {
		path: "/api/v1/login/sessions",
		method: "POST",
		body: pendingAccountId ? { accountId: pendingAccountId } : {},
		responseType: "json",
		timeoutMs: 30_000,
	});
	if (!response.ok) {
		const detail = errorMessageFromResponse(response.body);
		throw new Error(
			detail
				? `二维码获取失败：${detail}`
				: `二维码获取失败（HTTP ${response.status}）`,
		);
	}
	const body = response.body as Record<string, unknown>;
	if (typeof body.id === "string") loginSessionId = body.id;
	const data = body?.data as Record<string, unknown> | undefined;
	const candidates = [
		data?.url,
		data?.qrcode,
		data?.qr_code,
		data?.qrCode,
		data?.img,
		body?.url,
		body?.qrcode,
		body?.qr_code,
		body?.qrCode,
		body?.img,
	];
	const payload = candidates.find(
		(value): value is string =>
			typeof value === "string" && value.trim().length > 0,
	);
	if (!payload) throw new Error("QR response did not contain a URL");
	return payload;
}

export async function captureCurrentSession(
	ctx: PluginContext,
): Promise<string> {
	const session = await services(ctx).readDataFile(
		SERVICE_ID,
		SESSION_FILE,
		"utf8",
	);
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
	pendingAccountId = account.id;
	return account;
}

export async function persistLoggedInAccount(
	ctx: PluginContext,
	account: XhsAccount,
): Promise<XhsAccount> {
	// The service owns Playwright storage state. Keep only non-sensitive account metadata in the plugin.
	pendingAccountId = undefined;
	const state = await readAccountState(ctx);
	const next = {
		...account,
		status: "connected" as const,
		lastCheckedAt: new Date().toISOString(),
	};
	await writeAccountState(ctx, {
		schemaVersion: 1,
		activeAccountId: next.id,
		accounts: [...state.accounts.filter((item) => item.id !== next.id), next],
	});
	return next;
}

export async function switchAccount(
	ctx: PluginContext,
	accountId: string,
): Promise<XhsAccount> {
	const state = await readAccountState(ctx);
	const account = state.accounts.find((item) => item.id === accountId);
	if (!account) throw new Error("Account not found");
	const session = await readSession(ctx, accountId);
	const api = services(ctx);
	await api.stop(SERVICE_ID);
	if (session)
		await api.writeDataFile(SERVICE_ID, SESSION_FILE, session, "utf8");
	await api.start(SERVICE_ID);
	const activation = await api.request<unknown>(SERVICE_ID, {
		path: `/api/v1/accounts/${encodeURIComponent(accountId)}/activate`,
		method: "POST",
		responseType: "json",
		timeoutMs: 10_000,
	});
	if (!activation.ok) {
		if (activation.status === 401 || activation.status === 404)
			throw new Error("The selected account session is no longer valid; sign in again");
		throw new Error(`Unable to activate account: HTTP ${activation.status}`);
	}
	const identity = identityFromProfile(activation.body);
	const next = {
		...account,
		nickname: identity.nickname ?? account.nickname,
		userId: identity.userId ?? account.userId,
		avatarUrl: identity.avatarUrl ?? account.avatarUrl,
		status: "connected" as const,
		lastCheckedAt: new Date().toISOString(),
	};
	await writeAccountState(ctx, {
		schemaVersion: 1,
		activeAccountId: accountId,
		accounts: state.accounts.map((item) =>
			item.id === accountId ? next : item,
		),
	});
	return next;
}

export async function removeAccount(
	ctx: PluginContext,
	accountId: string,
): Promise<void> {
	const state = await readAccountState(ctx);
	const nextAccounts = state.accounts.filter((item) => item.id !== accountId);
	const response = await services(ctx).request<unknown>(SERVICE_ID, {
		path: `/api/v1/accounts/${encodeURIComponent(accountId)}`,
		method: "DELETE",
		responseType: "json",
		timeoutMs: 10_000,
	});
	if (!response.ok && response.status !== 404)
		throw new Error(`Unable to remove account: HTTP ${response.status}`);
	await (ctx as ManagedPluginContext).secrets.delete(accountKey(accountId));
	await writeAccountState(ctx, {
		schemaVersion: 1,
		activeAccountId:
			state.activeAccountId === accountId
				? nextAccounts[0]?.id
				: state.activeAccountId,
		accounts: nextAccounts,
	});
}

export async function renameAccount(
	ctx: PluginContext,
	accountId: string,
	name: string,
): Promise<XhsAccount | undefined> {
	const trimmed = name.trim();
	if (!trimmed) return undefined;
	const state = await readAccountState(ctx);
	const account = state.accounts.find((item) => item.id === accountId);
	if (!account) return undefined;
	const next: XhsAccount = { ...account, name: trimmed };
	await writeAccountState(ctx, {
		...state,
		accounts: state.accounts.map((item) =>
			item.id === accountId ? next : item,
		),
	});
	return next;
}

export { writeAccountState };
