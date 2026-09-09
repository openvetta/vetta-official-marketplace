import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createAccountStore, type AccountMetadata } from "./accounts/account-store.js";
import {
	BrowserManager,
	type FeedDetailOptions,
	type ProfileIdentity,
	type PublishOptions,
	type SearchFilters,
} from "./browser/browser-manager.js";
import { loginSessionStatus } from "./login/session-status.js";
import {
	resolveAccount,
	withAccountSelector,
	type McpToolSchema,
} from "./mcp/account-routing.js";

const port = Number(process.env.VETTA_SERVICE_PORT ?? 0);
const dataRoot = process.env.VETTA_SERVICE_DATA_DIR ?? "./service-data";
const store = createAccountStore(dataRoot);
const browser = new BrowserManager(store, dataRoot);
type LoginSession = {
	page: import("playwright-core").Page;
	context: import("playwright-core").BrowserContext;
	createdAt: number;
	accountId?: string;
	completion?: Promise<AccountMetadata>;
};
const sessions = new Map<string, LoginSession>();
let activeAccountId: string | undefined;
let latestLoginSessionId: string | undefined;
const activeAccountPath = join(dataRoot, "active-account.json");

async function persistActiveAccountId(): Promise<void> {
	await writeFile(
		activeAccountPath,
		JSON.stringify({ accountId: activeAccountId ?? null }),
		{ mode: 0o600 },
	);
}

async function restoreActiveAccountId(): Promise<void> {
	try {
		const parsed: unknown = JSON.parse(await readFile(activeAccountPath, "utf8"));
		const accountId = parsed && typeof parsed === "object" && "accountId" in parsed
			? (parsed as { accountId?: unknown }).accountId
			: undefined;
		if (typeof accountId === "string" && await store.get(accountId)) {
			activeAccountId = accountId;
			return;
		}
	} catch {
		// Older service data did not persist the active account.
	}
	const accounts = await store.list();
	const latest = [...accounts].sort((left, right) =>
		(left.updatedAt ?? "").localeCompare(right.updatedAt ?? ""),
	).at(-1);
	if (latest) {
		activeAccountId = latest.id;
		await persistActiveAccountId();
	}
}

function accountMetadata(id: string, profile: ProfileIdentity, previous?: AccountMetadata): AccountMetadata {
	const now = new Date().toISOString();
	return {
		id,
		name: previous?.name ?? "小红书账号",
		username: profile.nickname ?? previous?.username,
		userId: profile.userId ?? previous?.userId,
		avatarUrl: profile.avatarUrl ?? previous?.avatarUrl,
		createdAt: previous?.createdAt ?? now,
		updatedAt: now,
	};
}

async function qrPayload(page: import("playwright-core").Page): Promise<string> {
		const image = page.locator(".login-container .qrcode-img, img.qrcode-img, img[class*='qrcode'], img[class*='qr-code']").first();
		try {
			await image.waitFor({ state: "visible", timeout: 15_000 });
			const src = await image.getAttribute("src");
			if (src) return src;
		} catch {
			// Try a canvas QR below.
		}
		const canvas = page.locator(".login-container canvas, canvas[class*='qrcode'], canvas[class*='qr-code']").first();
		if (await canvas.count()) {
			await canvas.waitFor({ state: "visible", timeout: 5_000 });
			const png = await canvas.screenshot({ type: "png" });
			return `data:image/png;base64,${png.toString("base64")}`;
		}
		const message = (await page.locator("body").innerText().catch(() => "")).trim().replace(/\\s+/gu, " ").slice(0, 180);
		throw new Error(message ? `小红书未返回二维码：${message}` : "小红书未返回二维码");
}

async function completeLoginSession(sessionId: string, session: LoginSession): Promise<AccountMetadata> {
	if (session.completion) return session.completion;
	session.completion = (async () => {
		const accountId = session.accountId ?? `account-${Date.now().toString(36)}`;
		const profile = await browser.readProfile(session.page);
		const account = accountMetadata(accountId, profile, await store.get(accountId));
		await store.upsert(account);
		await browser.persist(accountId, session.context);
		activeAccountId = accountId;
		await persistActiveAccountId();
		await session.context.close();
		sessions.delete(sessionId);
		if (latestLoginSessionId === sessionId) latestLoginSessionId = undefined;
		return account;
	})();
	return session.completion;
}

async function discardLoginSession(sessionId: string, session: LoginSession): Promise<void> {
	await session.context.close().catch(() => undefined);
	sessions.delete(sessionId);
	if (latestLoginSessionId === sessionId) latestLoginSessionId = undefined;
}

function json(response: ServerResponse, status: number, body: unknown): void {
	response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	response.end(JSON.stringify(body));
}

const mcpTools: McpToolSchema[] = [
	{
		name: "get_login_qrcode",
		description: "获取小红书登录二维码。",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "delete_cookies",
		description: "清除当前登录会话并重置登录状态。此工具具有破坏性。",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "publish_content",
		description: "发布小红书图文内容，支持本地图片或 HTTP(S) 图片地址、标签、定时、可见范围、原创声明和商品绑定。此工具会改变账号内容。",
		inputSchema: {
			type: "object",
			properties: {
				title: { type: "string" }, content: { type: "string" }, images: { type: "array", items: { type: "string" } },
				tags: { type: "array", items: { type: "string" }, maxItems: 10 }, schedule_at: { type: "string", description: "ISO8601 时间，提前 1 小时至 14 天" },
				is_original: { type: "boolean" }, visibility: { type: "string", enum: ["公开可见", "仅自己可见", "仅互关好友可见"] }, products: { type: "array", items: { type: "string" } },
			},
			required: ["title", "content", "images"],
		},
	},
	{
		name: "publish_with_video",
		description: "发布小红书视频内容，支持标签、定时、可见范围和商品绑定。视频使用本地文件。此工具会改变账号内容。",
		inputSchema: {
			type: "object",
			properties: {
				title: { type: "string" }, content: { type: "string" }, video: { type: "string" },
				tags: { type: "array", items: { type: "string" }, maxItems: 10 }, schedule_at: { type: "string", description: "ISO8601 时间，提前 1 小时至 14 天" },
				visibility: { type: "string", enum: ["公开可见", "仅自己可见", "仅互关好友可见"] }, products: { type: "array", items: { type: "string" } },
			},
			required: ["title", "content", "video"],
		},
	},
	{
		name: "xiaohongshu_list_accounts",
		description: "List locally managed Xiaohongshu accounts.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "xiaohongshu_active_account",
		description: "Get the active Xiaohongshu account.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "check_login_status",
		description: "检查当前激活的小红书账号登录状态。",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "list_feeds",
		description: "获取当前激活账号的小红书首页笔记流。",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "search_feeds",
		description: "搜索小红书笔记。",
		inputSchema: {
			type: "object",
			properties: {
				keyword: { type: "string", description: "搜索关键词" },
				sort_by: { type: "string", enum: ["综合", "最新", "最多点赞", "最多评论", "最多收藏"] }, note_type: { type: "string", enum: ["不限", "视频", "图文"] },
				publish_time: { type: "string", enum: ["不限", "一天内", "一周内", "半年内"] }, search_scope: { type: "string", enum: ["不限", "已看过", "未看过", "已关注"] }, location: { type: "string", enum: ["不限", "同城", "附近"] },
			},
			required: ["keyword"],
		},
	},
	{
		name: "get_feed_detail",
		description: "获取小红书笔记详情、互动状态和已加载的评论。",
		inputSchema: {
			type: "object",
			properties: {
				feed_id: { type: "string", description: "笔记 ID" },
				xsec_token: { type: "string", description: "笔记访问令牌，可从列表结果获取" },
				load_all_comments: { type: "boolean" }, limit: { type: "integer", minimum: 1, maximum: 100 }, click_more_replies: { type: "boolean" }, reply_limit: { type: "integer", minimum: 1, maximum: 100 }, scroll_speed: { type: "string", enum: ["slow", "normal", "fast"] },
			},
			required: ["feed_id"],
		},
	},
	{
		name: "user_profile",
		description: "获取指定小红书用户主页及笔记。",
		inputSchema: {
			type: "object",
			properties: {
				user_id: { type: "string", description: "用户 ID" },
				xsec_token: { type: "string", description: "用户主页访问令牌，可从列表结果获取" },
				tab: { type: "string", enum: ["note", "fav", "liked"] },
			},
			required: ["user_id"],
		},
	},
	{
		name: "get_my_profile",
		description: "获取当前激活账号的小红书个人主页。",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "post_comment_to_feed",
		description: "发表评论到小红书笔记。此工具会改变账号内容。",
		inputSchema: {
			type: "object",
			properties: {
				feed_id: { type: "string" },
				xsec_token: { type: "string" },
				content: { type: "string" },
			},
			required: ["feed_id", "content"],
		},
	},
	{
		name: "reply_comment_in_feed",
		description: "回复小红书笔记下的指定评论。此工具会改变账号内容。",
		inputSchema: {
			type: "object",
			properties: {
				feed_id: { type: "string" },
				xsec_token: { type: "string" },
				comment_id: { type: "string" },
				user_id: { type: "string" },
				content: { type: "string" },
			},
			required: ["feed_id", "content"],
		},
	},
	{
		name: "like_feed",
		description: "给小红书笔记点赞或取消点赞。此工具会改变账号状态。",
		inputSchema: {
			type: "object",
			properties: { feed_id: { type: "string" }, xsec_token: { type: "string" }, unlike: { type: "boolean" } },
			required: ["feed_id"],
		},
	},
	{
		name: "favorite_feed",
		description: "收藏或取消收藏小红书笔记。此工具会改变账号状态。",
		inputSchema: {
			type: "object",
			properties: { feed_id: { type: "string" }, xsec_token: { type: "string" }, unfavorite: { type: "boolean" } },
			required: ["feed_id"],
		},
	},
	{
		name: "like_notification",
		description: "给通知中的评论点赞或取消点赞。此工具会改变账号状态。",
		inputSchema: { type: "object", properties: { comment_id: { type: "string" }, unlike: { type: "boolean" } }, required: ["comment_id"] },
	},
	{
		name: "reply_notification",
		description: "回复通知中的评论。此工具会改变账号内容。",
		inputSchema: { type: "object", properties: { comment_id: { type: "string" }, content: { type: "string" } }, required: ["comment_id", "content"] },
	},
	{
		name: "get_unread_count",
		description: "获取当前激活账号的通知未读数。",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "list_notifications",
		description: "获取当前激活账号的通知列表。",
		inputSchema: {
			type: "object",
			properties: {
				tab: { type: "string", enum: ["mentions", "likes", "connections"] },
				limit: { type: "integer", minimum: 1, maximum: 100 },
			},
		},
	},
];
const routedMcpTools = mcpTools.map(withAccountSelector);
const notificationTabs = new Set(["mentions", "likes", "connections"]);

function recordOf(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: undefined;
}

function stringArg(args: Record<string, unknown>, key: string, required = false): string | undefined {
	const value = args[key];
	if (typeof value === "string" && value.trim()) return value.trim();
	if (required) throw new Error(`缺少参数 ${key}`);
	return undefined;
}

function numberArg(args: Record<string, unknown>, key: string, fallback: number): number {
	const value = args[key];
	return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(100, Math.floor(value))) : fallback;
}

function stringArrayArg(args: Record<string, unknown>, key: string): string[] {
	const value = args[key];
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function publishOptionsFromArgs(args: Record<string, unknown>): PublishOptions {
	const options: PublishOptions = {
		tags: stringArrayArg(args, "tags"),
		schedule_at: stringArg(args, "schedule_at"),
		is_original: args.is_original === true,
		visibility: stringArg(args, "visibility"),
		products: stringArrayArg(args, "products"),
	};
	return options;
}

function searchFiltersFromArgs(args: Record<string, unknown>): SearchFilters {
	return {
		sort_by: stringArg(args, "sort_by"),
		note_type: stringArg(args, "note_type"),
		publish_time: stringArg(args, "publish_time"),
		search_scope: stringArg(args, "search_scope"),
		location: stringArg(args, "location"),
	};
}

function feedDetailOptionsFromArgs(args: Record<string, unknown>): FeedDetailOptions {
	return {
		load_all_comments: args.load_all_comments === true,
		limit: numberArg(args, "limit", 20),
		click_more_replies: args.click_more_replies === true,
		reply_limit: numberArg(args, "reply_limit", 10),
		scroll_speed: args.scroll_speed === "slow" || args.scroll_speed === "fast" ? args.scroll_speed : "normal",
	};
}

function mcpText(id: unknown, value: unknown): Record<string, unknown> {
	return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(value) ?? "null" }] } };
}

async function accountOrThrow(args: Record<string, unknown>): Promise<AccountMetadata> {
	return resolveAccount(args, activeAccountId, (accountId) => store.get(accountId));
}

async function callMcpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
	if (name === "xiaohongshu_list_accounts") return { accounts: await store.list(), activeAccountId };
	if (name === "xiaohongshu_active_account") return { account: activeAccountId ? await store.get(activeAccountId) : undefined };
	if (name === "get_login_qrcode") {
		const login = await browser.createLoginSession();
		const sessionId = randomUUID();
		sessions.set(sessionId, { ...login, createdAt: Date.now() });
		latestLoginSessionId = sessionId;
		return { id: sessionId, status: "waiting", url: await qrPayload(login.page), expiresAt: Date.now() + 180_000 };
	}
	if (name === "delete_cookies") {
		if (latestLoginSessionId) {
			const session = sessions.get(latestLoginSessionId);
			await session?.context.close();
			sessions.delete(latestLoginSessionId);
			latestLoginSessionId = undefined;
		}
		activeAccountId = undefined;
		await persistActiveAccountId();
		return { success: true };
	}
	const account = await accountOrThrow(args);
	if (name === "publish_content") {
		const title = stringArg(args, "title", true) as string;
		const content = stringArg(args, "content", true) as string;
		const images = Array.isArray(args.images) ? args.images.filter((value): value is string => typeof value === "string") : [];
		return await browser.publishContent(account.id, title, content, images, publishOptionsFromArgs(args));
	}
	if (name === "publish_with_video") {
		const title = stringArg(args, "title", true) as string;
		const content = stringArg(args, "content", true) as string;
		const video = stringArg(args, "video", true) as string;
		return await browser.publishVideo(account.id, title, content, video, publishOptionsFromArgs(args));
	}
	if (name === "check_login_status") return { account: account.id, ...(await browser.checkLogin(account.id)) };
	if (name === "list_feeds") return { account: account.id, feeds: await browser.listFeeds(account.id) };
	if (name === "search_feeds") {
		const keyword = stringArg(args, "keyword", true) as string;
		return { account: account.id, keyword, filters: searchFiltersFromArgs(args), feeds: await browser.searchFeeds(account.id, keyword, searchFiltersFromArgs(args)) };
	}
	if (name === "get_feed_detail") {
		const feedId = stringArg(args, "feed_id", true) as string;
		return { account: account.id, feed: await browser.feedDetail(account.id, feedId, stringArg(args, "xsec_token"), feedDetailOptionsFromArgs(args)) };
	}
	if (name === "user_profile") {
		const userId = stringArg(args, "user_id", true) as string;
		return { account: account.id, profile: await browser.userProfile(account.id, userId, stringArg(args, "xsec_token"), stringArg(args, "tab", false) ?? "note") };
	}
	if (name === "get_my_profile") return { account: account.id, profile: await browser.myProfile(account.id) };
	if (name === "post_comment_to_feed") {
		const feedId = stringArg(args, "feed_id", true) as string;
		const content = stringArg(args, "content", true) as string;
		return await browser.postComment(account.id, feedId, stringArg(args, "xsec_token"), content);
	}
	if (name === "reply_comment_in_feed") {
		const feedId = stringArg(args, "feed_id", true) as string;
		const content = stringArg(args, "content", true) as string;
		const commentId = stringArg(args, "comment_id");
		const userId = stringArg(args, "user_id");
		if (!commentId && !userId) throw new Error("缺少 comment_id 或 user_id");
		return await browser.replyComment(account.id, feedId, stringArg(args, "xsec_token"), commentId, userId, content);
	}
	if (name === "like_feed") {
		const feedId = stringArg(args, "feed_id", true) as string;
		return await browser.likeFeed(account.id, feedId, stringArg(args, "xsec_token"), args.unlike === true);
	}
	if (name === "favorite_feed") {
		const feedId = stringArg(args, "feed_id", true) as string;
		return await browser.favoriteFeed(account.id, feedId, stringArg(args, "xsec_token"), args.unfavorite === true);
	}
	if (name === "like_notification") {
		const commentId = stringArg(args, "comment_id", true) as string;
		return await browser.likeNotification(account.id, commentId, args.unlike === true);
	}
	if (name === "reply_notification") {
		const commentId = stringArg(args, "comment_id", true) as string;
		const content = stringArg(args, "content", true) as string;
		return await browser.replyNotification(account.id, commentId, content);
	}
	if (name === "get_unread_count") return { account: account.id, unread: await browser.unreadCount(account.id) };
	if (name === "list_notifications") {
		const tab = stringArg(args, "tab", false) ?? "mentions";
		if (!notificationTabs.has(tab)) throw new Error("tab 必须是 mentions、likes 或 connections");
		return { account: account.id, tab, notifications: await browser.notifications(account.id, tab, numberArg(args, "limit", 20)) };
	}
	throw new Error("Unknown tool");
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.from(chunk));
	if (chunks.length === 0) return {};
	const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
	const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
	if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { status: "ok", service: "xiaohongshu" });
	if (request.method === "GET" && url.pathname === "/api/v1/accounts") return json(response, 200, { accounts: await store.list(), activeAccountId });
	if (request.method === "GET" && url.pathname === "/api/v1/accounts/active") return json(response, 200, { account: activeAccountId ? await store.get(activeAccountId) : undefined });
	if (request.method === "GET" && url.pathname === "/api/v1/user/me") {
		if (activeAccountId) {
			const status = await browser.checkLogin(activeAccountId).catch((): {
				loggedIn: boolean;
				username?: string;
				userId?: string;
				avatarUrl?: string;
			} => ({ loggedIn: false }));
			const current = await store.get(activeAccountId);
			if (status.loggedIn && current) {
				const refreshed = accountMetadata(activeAccountId, {
					nickname: status.username,
					userId: status.userId,
					avatarUrl: status.avatarUrl,
				}, current);
				await store.upsert(refreshed);
			}
		}
		const account = activeAccountId ? await store.get(activeAccountId) : undefined;
		return account
			? json(response, 200, { data: { nickname: account.username ?? account.name, user_id: account.userId ?? account.id, avatar_url: account.avatarUrl } })
			: json(response, 401, { error: "not logged in" });
	}
	if (request.method === "GET" && url.pathname === "/api/v1/login/qrcode") {
		const login = await browser.createLoginSession();
		const sessionId = randomUUID();
		sessions.set(sessionId, { ...login, createdAt: Date.now() });
		latestLoginSessionId = sessionId;
		const qr = await qrPayload(login.page);
		return json(response, 200, { url: qr, id: sessionId, status: "waiting", expiresAt: Date.now() + 180_000 });
	}
	if (request.method === "GET" && url.pathname === "/api/v1/login/status") {
		const sessionId = latestLoginSessionId;
		const session = sessionId ? sessions.get(sessionId) : undefined;
		if (sessionId && session) {
			const currentSessionId = sessionId;
			const loginState = await browser.loginStatus(session.page, session.context);
			const status = loginSessionStatus({
				createdAt: session.createdAt,
				now: Date.now(),
				loggedIn: loginState.loggedIn,
			});
			if (status === "waiting")
				return json(response, 200, { data: { is_logged_in: false } });
			if (status === "expired") {
				await discardLoginSession(currentSessionId, session);
				return json(response, 200, { data: { is_logged_in: false } });
			}
			const account = await completeLoginSession(currentSessionId, session);
			return json(response, 200, { data: { is_logged_in: true, nickname: account.username ?? account.name, user_id: account.userId ?? account.id, avatar_url: account.avatarUrl } });
		}
		if (!activeAccountId) return json(response, 200, { data: { is_logged_in: false } });
		const status = await browser.checkLogin(activeAccountId);
		const current = await store.get(activeAccountId);
		if (current && status.loggedIn) {
			const account = accountMetadata(activeAccountId, { nickname: status.username, userId: status.userId, avatarUrl: status.avatarUrl }, current);
			await store.upsert(account);
			return json(response, 200, { data: { is_logged_in: true, username: account.username, user_id: account.userId ?? account.id, avatar_url: account.avatarUrl } });
		}
		return json(response, 200, { data: { is_logged_in: status.loggedIn, username: status.username, user_id: status.userId, avatar_url: status.avatarUrl } });
	}
	if (request.method === "DELETE" && url.pathname === "/api/v1/login/cookies") {
		if (latestLoginSessionId) {
			const session = sessions.get(latestLoginSessionId);
			await session?.context.close();
			sessions.delete(latestLoginSessionId);
			latestLoginSessionId = undefined;
		}
		activeAccountId = undefined;
		await persistActiveAccountId();
		return json(response, 200, { ok: true });
	}
	if (request.method === "POST" && url.pathname === "/api/v1/login/sessions") {
		const input = await body(request);
		const sessionId = randomUUID();
		const login = await browser.createLoginSession();
		sessions.set(sessionId, { ...login, createdAt: Date.now(), accountId: typeof input.accountId === "string" ? input.accountId : undefined });
		latestLoginSessionId = sessionId;
		const qr = await qrPayload(login.page);
		return json(response, 201, { id: sessionId, accountId: typeof input.accountId === "string" ? input.accountId : undefined, status: "waiting", qrCode: qr, expiresAt: Date.now() + 180_000 });
	}
	const sessionMatch = url.pathname.match(/^\/api\/v1\/login\/sessions\/([^/]+)$/u);
	if (request.method === "GET" && sessionMatch) {
		const session = sessions.get(sessionMatch[1]);
		if (!session) return json(response, 404, { error: "login session not found" });
		const loginState = await browser.loginStatus(session.page, session.context);
		const status = loginSessionStatus({ createdAt: session.createdAt, now: Date.now(), loggedIn: loginState.loggedIn });
		if (status === "waiting")
			return json(response, 200, { id: sessionMatch[1], status: "waiting" });
		if (status === "expired") {
			await discardLoginSession(sessionMatch[1], session);
			return json(response, 410, { id: sessionMatch[1], status: "expired" });
		}
		const account = await completeLoginSession(sessionMatch[1], session);
		return json(response, 200, { id: sessionMatch[1], status: "authenticated", account });
	}
	const activateMatch = url.pathname.match(/^\/api\/v1\/accounts\/([^/]+)\/activate$/u);
	if (request.method === "POST" && activateMatch) {
		const accountId = activateMatch[1];
		const status = await browser.checkLogin(accountId);
		if (!status.loggedIn) return json(response, 401, { error: "account session expired" });
		const account = await store.get(accountId) ?? accountMetadata(accountId, {
			nickname: status.username,
			userId: status.userId,
			avatarUrl: status.avatarUrl,
		});
		const refreshed = accountMetadata(accountId, {
			nickname: status.username,
			userId: status.userId,
			avatarUrl: status.avatarUrl,
		}, account);
		await store.upsert(refreshed);
		activeAccountId = accountId;
		await persistActiveAccountId();
		return json(response, 200, { account: refreshed });
	}
	const accountMatch = url.pathname.match(/^\/api\/v1\/accounts\/([^/]+)$/u);
	if (request.method === "DELETE" && accountMatch) {
		await browser.removeAccount(accountMatch[1]);
		if (activeAccountId === accountMatch[1]) {
			activeAccountId = (await store.list())[0]?.id;
			await persistActiveAccountId();
		}
		return json(response, 204, undefined);
	}
	if (request.method === "POST" && url.pathname === "/mcp") {
		const rpc = await body(request);
		const id = rpc.id ?? null;
		if (rpc.method === "initialize") return json(response, 200, { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "xiaohongshu", version: "1.1.19" } } });
		if (rpc.method === "tools/list") return json(response, 200, { jsonrpc: "2.0", id, result: { tools: routedMcpTools } });
		if (rpc.method === "tools/call") {
			const params = rpc.params as Record<string, unknown> | undefined;
			const name = params?.name;
			const args = recordOf(params?.arguments) ?? {};
			if (typeof name !== "string") return json(response, 200, { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } });
			try {
				return json(response, 200, mcpText(id, await callMcpTool(name, args)));
			} catch (error: unknown) {
				return json(response, 200, { jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] } });
			}
		}
		return json(response, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: "Unsupported MCP method" } });
	}
	json(response, 404, { error: "not found" });
}

await mkdir(dataRoot, { recursive: true });
await restoreActiveAccountId();
const server = createServer((request, response) => void route(request, response).catch((error: unknown) => json(response, 500, { error: error instanceof Error ? error.message : String(error) })));
server.listen(port, "127.0.0.1", () => process.stdout.write(`ready:${(server.address() as { port: number }).port}\n`));
const shutdown = () => void browser.close().finally(() => server.close());
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
