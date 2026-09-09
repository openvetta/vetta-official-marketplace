import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { AccountStore } from "../accounts/account-store.js";

const HOME_URL = "https://www.xiaohongshu.com/";
const CREATOR_PUBLISH_URL = "https://creator.xiaohongshu.com/publish/publish?source=official";
const execFileAsync = promisify(execFile);
const browserInstallations = new Map<string, Promise<void>>();

export interface ChromiumProvisionOptions {
	cacheDir: string;
	executableOverride?: string;
	cliPath?: string;
	install?: (cliPath: string, cacheDir: string) => Promise<void>;
	locate?: (cacheDir: string) => Promise<string | undefined>;
}

export interface ProfileIdentity {
	nickname?: string;
	userId?: string;
	avatarUrl?: string;
}

export type XiaohongshuPageData = unknown;

export type SearchFilters = {
	sort_by?: string;
	note_type?: string;
	publish_time?: string;
	search_scope?: string;
	location?: string;
};

export type FeedDetailOptions = {
	load_all_comments?: boolean;
	limit?: number;
	click_more_replies?: boolean;
	reply_limit?: number;
	scroll_speed?: "slow" | "normal" | "fast";
};

export type PublishOptions = {
	tags?: string[];
	schedule_at?: string;
	is_original?: boolean;
	visibility?: string;
	products?: string[];
};

const MAX_TITLE_LENGTH = 20;
const MAX_CONTENT_LENGTH = 1_000;
const MAX_TAGS = 10;
const MIN_SCHEDULE_LEAD_MS = 60 * 60 * 1_000;
const MAX_SCHEDULE_LEAD_MS = 14 * 24 * 60 * 60 * 1_000;

/**
 * 小红书标题按 UTF-16 字节折算长度：ASCII 1，非 ASCII 2，最后除以 2 向上取整。
 * 这个规则与创作者页面的 20 字限制一致，也能正确处理 emoji 的代理项。
 */
export function xiaohongshuTitleLength(value: string): number {
	let byteLength = 0;
	for (let index = 0; index < value.length; index += 1) {
		byteLength += value.charCodeAt(index) > 127 ? 2 : 1;
	}
	return Math.ceil(byteLength / 2);
}

export function normalizePublishOptions(options: PublishOptions = {}, now = Date.now()): PublishOptions {
	const visibility = options.visibility?.trim();
	if (visibility && !["公开可见", "仅自己可见", "仅互关好友可见"].includes(visibility)) {
		throw new Error("可见范围必须是公开可见、仅自己可见或仅互关好友可见");
	}

	let scheduleAt = options.schedule_at?.trim();
	if (scheduleAt) {
		if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(scheduleAt)) {
			throw new Error("schedule_at 必须是有效的 ISO8601 时间");
		}
		const timestamp = Date.parse(scheduleAt);
		if (!Number.isFinite(timestamp)) throw new Error("schedule_at 必须是有效的 ISO8601 时间");
		const lead = timestamp - now;
		if (lead < MIN_SCHEDULE_LEAD_MS) throw new Error("定时发布时间必须至少在 1 小时后");
		if (lead > MAX_SCHEDULE_LEAD_MS) throw new Error("定时发布时间不能超过 14 天");
	}

	const tags = (options.tags ?? [])
		.filter((tag): tag is string => typeof tag === "string")
		.map((tag) => tag.trim().replace(/^#/u, ""))
		.filter(Boolean)
		.slice(0, MAX_TAGS);
	const products = (options.products ?? [])
		.filter((product): product is string => typeof product === "string")
		.map((product) => product.trim())
		.filter(Boolean);
	return {
		tags,
		schedule_at: scheduleAt || undefined,
		is_original: options.is_original === true,
		visibility: visibility || undefined,
		products,
	};
}

export function validatePublishText(title: string, content: string): void {
	if (!title.trim()) throw new Error("标题不能为空");
	if (xiaohongshuTitleLength(title) > MAX_TITLE_LENGTH) throw new Error("标题长度超过小红书允许的 20 字限制");
	if (!content.trim()) throw new Error("正文不能为空");
	if (Array.from(content).length > MAX_CONTENT_LENGTH) throw new Error("正文长度超过小红书允许的 1000 字限制");
}

async function resolveImageInputs(dataRoot: string, images: string[]): Promise<{ files: string[]; cleanup: () => Promise<void> }> {
	const remote = images.filter((value) => /^https?:\/\//iu.test(value));
	if (remote.length === 0) {
		if (images.some((path) => !path || !existsSync(path))) throw new Error("图片必须是存在的本地文件路径或 HTTP(S) 图片地址");
		return { files: images, cleanup: async () => undefined };
	}
	const directory = join(dataRoot, "publish-upload", randomUUID());
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const files: string[] = [];
	try {
		for (let index = 0; index < images.length; index += 1) {
			const source = images[index];
			if (!/^https?:\/\//iu.test(source)) {
				if (!source || !existsSync(source)) throw new Error(`图片路径无效：${source}`);
				files.push(source);
				continue;
			}
			const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
			if (!response.ok) throw new Error(`图片下载失败（HTTP ${response.status}）：${source}`);
			const contentType = response.headers.get("content-type") ?? "";
			if (contentType && !contentType.toLowerCase().startsWith("image/")) throw new Error(`远程地址不是图片：${source}`);
			const bytes = Buffer.from(await response.arrayBuffer());
			if (bytes.byteLength === 0 || bytes.byteLength > 20 * 1024 * 1024) throw new Error(`图片大小不合法：${source}`);
			const extension = contentType.split("/", 2)[1]?.split(";", 1)[0]?.replace(/[^a-z0-9]/giu, "") || "jpg";
			const target = join(directory, `${index}.${extension}`);
			await writeFile(target, bytes, { mode: 0o600 });
			files.push(target);
		}
	} catch (error) {
		await rm(directory, { recursive: true, force: true }).catch(() => undefined);
		throw error;
	}
	return {
		files,
		cleanup: async () => { await rm(directory, { recursive: true, force: true }).catch(() => undefined); },
	};
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: undefined;
}

export function unwrapPageValue(value: unknown): unknown {
	const record = recordValue(value);
	if (!record) return value;
	if ("value" in record) return record.value;
	if ("_value" in record) return record._value;
	return value;
}

export function valueAtPath(value: unknown, path: readonly string[]): unknown {
	let current = value;
	for (const key of path) {
		const record = recordValue(current);
		if (!record) return undefined;
		current = record[key];
	}
	return unwrapPageValue(current);
}

function stateAt(value: unknown, path: readonly string[]): unknown {
	let current = value;
	for (const key of path) {
		const record = recordValue(current);
		if (!record) return undefined;
		current = record[key];
	}
	return current;
}

const searchFilterOptions: Record<keyof SearchFilters, { label: string; values: readonly string[] }> = {
	sort_by: { label: "排序依据", values: ["综合", "最新", "最多点赞", "最多评论", "最多收藏"] },
	note_type: { label: "笔记类型", values: ["不限", "视频", "图文"] },
	publish_time: { label: "发布时间", values: ["不限", "一天内", "一周内", "半年内"] },
	search_scope: { label: "搜索范围", values: ["不限", "已看过", "未看过", "已关注"] },
	location: { label: "位置距离", values: ["不限", "同城", "附近"] },
};

function validateSearchFilters(filters: SearchFilters): Array<{ label: string; option: string }> {
	const pending: Array<{ label: string; option: string }> = [];
	for (const key of Object.keys(searchFilterOptions) as Array<keyof SearchFilters>) {
		const option = filters[key];
		if (!option) continue;
		const group = searchFilterOptions[key];
		if (!group.values.includes(option)) throw new Error(`${group.label}不支持「${option}」，可选：${group.values.join("、")}`);
		pending.push({ label: group.label, option });
	}
	return pending;
}

export function arrayAtPath(value: unknown, path: readonly string[]): unknown[] {
	const result = valueAtPath(value, path);
	return Array.isArray(result) ? result : [];
}

export function detailAtPath(value: unknown, id: string): unknown {
	const map = recordValue(valueAtPath(value, ["note", "noteDetailMap"]));
	return map?.[id];
}

export function loggedInFromSignals(input: {
	guest?: boolean;
	hasUserNavigation: boolean;
	hasSessionCookie: boolean;
	profile: ProfileIdentity;
}): boolean {
	if (input.guest === true) return false;
	return input.hasUserNavigation || input.hasSessionCookie ||
		(input.guest === false && Boolean(input.profile.userId));
}

interface PageUserState {
	value?: unknown;
	guest?: boolean;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function avatarValue(value: unknown): string | undefined {
	const direct = stringValue(value);
	if (direct) return direct;
	if (Array.isArray(value)) {
		for (const item of value) {
			const avatar = avatarValue(item);
			if (avatar) return avatar;
		}
		return undefined;
	}
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	for (const key of ["url", "src", "original", "default"]) {
		const avatar = stringValue(record[key]);
		if (avatar) return avatar;
	}
	return undefined;
}

/**
 * 小红书把当前用户信息放在不同版本的 __INITIAL_STATE__ 层级中。
 * 只读取明确的身份字段，避免把页面其它文本误当成用户资料。
 */
export function profileIdentityFromValue(value: unknown): ProfileIdentity {
	const candidates: Record<string, unknown>[] = [];
	const pending: unknown[] = [value];
	const seen = new Set<unknown>();
	while (pending.length > 0 && candidates.length < 32) {
		const current = pending.shift();
		if (!current || typeof current !== "object" || seen.has(current)) continue;
		seen.add(current);
		const record = current as Record<string, unknown>;
		candidates.push(record);
		for (const key of ["user", "userInfo", "value", "data", "basicInfo", "userBasicInfo"]) {
			if (record[key] && typeof record[key] === "object") pending.push(record[key]);
		}
	}
	const first = (keys: string[]): string | undefined => {
		for (const candidate of candidates) {
			for (const key of keys) {
				const value = stringValue(candidate[key]);
				if (value) return value;
			}
		}
		return undefined;
	};
	return {
		nickname: first(["nickname", "username", "nick_name"]),
		userId: first(["userId", "user_id", "redId", "red_id"]),
		avatarUrl: candidates
			.map((candidate) =>
				["avatar", "avatarUrl", "avatar_url", "image", "images"]
					.map((key) => avatarValue(candidate[key]))
					.find(Boolean),
			)
			.find(Boolean),
	};
}

async function findChromiumExecutable(cacheDir: string): Promise<string | undefined> {
	const pending = [resolve(cacheDir)];
	while (pending.length > 0) {
		const directory = pending.pop();
		if (!directory) continue;
		let entries;
		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				pending.push(path);
				continue;
			}
			if (
				(entry.name === "chrome.exe" && process.platform === "win32") ||
				(entry.name === "chrome" && process.platform === "linux") ||
				(entry.name === "Chromium" && process.platform === "darwin")
			) {
				return path;
			}
		}
	}
	return undefined;
}

function defaultCliPath(): string | undefined {
	const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
	const cliPath = join(serviceRoot, "node_modules", "playwright-core", "cli.js");
	return existsSync(cliPath) ? cliPath : undefined;
}

async function installChromium(cliPath: string, cacheDir: string): Promise<void> {
	await execFileAsync(process.execPath, [cliPath, "install", "chromium", "--no-shell", "--no-progress"], {
		env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: cacheDir },
		maxBuffer: 2 * 1024 * 1024,
	});
}

async function installOnce(cacheDir: string, cliPath: string, installer: (path: string, cache: string) => Promise<void>): Promise<void> {
	const key = resolve(cacheDir);
	const existing = browserInstallations.get(key);
	if (existing) return existing;
	const installation = Promise.resolve()
		.then(() => installer(cliPath, key))
		.finally(() => browserInstallations.delete(key));
	browserInstallations.set(key, installation);
	return installation;
}

export async function ensureChromiumExecutable(options: ChromiumProvisionOptions): Promise<string> {
	const cacheDir = resolve(options.cacheDir);
	const override = options.executableOverride?.trim();
	if (override) {
		if (!existsSync(override)) throw new Error(`XHS_BROWSER_EXECUTABLE does not exist: ${override}`);
		return override;
	}

	const locate = options.locate ?? findChromiumExecutable;
	let executable = await locate(cacheDir);
	if (executable) return executable;

	const cliPath = options.cliPath ?? defaultCliPath();
	const installer = options.install ?? installChromium;
	if (!cliPath) throw new Error("Playwright CLI is unavailable; cannot download Chromium");
	await installOnce(cacheDir, cliPath, installer);
	executable = await locate(cacheDir);
	if (!executable) throw new Error(`Chromium installation completed but no executable was found in ${cacheDir}`);
	return executable;
}

export class BrowserManager {
	private browser?: Browser;
	private browserStartup?: Promise<Browser>;
	private readonly contexts = new Map<string, BrowserContext>();

	constructor(private readonly store: AccountStore, private readonly dataRoot: string) {}

	private async ensureBrowser(): Promise<Browser> {
		if (this.browser) return this.browser;
		if (this.browserStartup) return this.browserStartup;
		this.browserStartup = this.startBrowser().finally(() => {
			this.browserStartup = undefined;
		});
		return this.browserStartup;
	}

	private async startBrowser(): Promise<Browser> {
		const browserCache = join(this.dataRoot, "browser-cache");
		await mkdir(browserCache, { recursive: true, mode: 0o700 });
		const runtimeCli = join(this.dataRoot, "..", "runtime", "node_modules", "playwright-core", "cli.js");
		const executablePath = await ensureChromiumExecutable({
			cacheDir: browserCache,
			executableOverride: process.env.XHS_BROWSER_EXECUTABLE,
			cliPath: existsSync(runtimeCli) ? runtimeCli : undefined,
		});
		this.browser = await chromium.launch({
			headless: process.env.XHS_HEADLESS !== "false",
			executablePath,
		});
		return this.browser;
	}

	async contextFor(accountId: string): Promise<BrowserContext> {
		const existing = this.contexts.get(accountId);
		if (existing) return existing;
		const browser = await this.ensureBrowser();
		const storagePath = this.store.storagePath(accountId);
		const context = await browser.newContext({
			storageState: existsSync(storagePath)
				? JSON.parse(await readFile(storagePath, "utf8")) as NonNullable<Parameters<Browser["newContext"]>[0]>["storageState"]
				: undefined,
			locale: "zh-CN",
		});
		this.contexts.set(accountId, context);
		return context;
	}

	private async pageUserState(page: Page): Promise<PageUserState> {
		return page.evaluate(() => {
			const root = (globalThis as unknown as { __INITIAL_STATE__?: unknown }).__INITIAL_STATE__;
			const record = root && typeof root === "object" ? root as Record<string, unknown> : undefined;
			const user = record?.user;
			if (!user || typeof user !== "object") return {};
			const userRecord = user as Record<string, unknown>;
			const info = userRecord.userInfo;
			const value = info && typeof info === "object" && "value" in info
				? (info as Record<string, unknown>).value
				: info;
			const valueRecord = value && typeof value === "object" ? value as Record<string, unknown> : undefined;
			const guest = valueRecord?.guest;
			return { value, guest: typeof guest === "boolean" ? guest : undefined };
		}).catch(() => ({}));
	}

	async readProfile(page: Page): Promise<ProfileIdentity> {
		let identity: ProfileIdentity = {};
		for (let attempt = 0; attempt < 4; attempt += 1) {
			const pageState = await this.pageUserState(page);
			if (pageState.guest === true) return {};
			const next = profileIdentityFromValue(pageState.value);
			identity = {
				nickname: next.nickname ?? identity.nickname,
				userId: next.userId ?? identity.userId,
				avatarUrl: next.avatarUrl ?? identity.avatarUrl,
			};
			if (identity.nickname && identity.userId && identity.avatarUrl) break;
			if (identity.userId && !page.url().includes(`/user/profile/${identity.userId}`)) {
				await page.goto(`${HOME_URL}user/profile/${encodeURIComponent(identity.userId)}`, {
					waitUntil: "domcontentloaded",
					timeout: 20_000,
				}).catch(() => undefined);
			}
			if (attempt < 3) await page.waitForTimeout(500);
		}

		return identity;
	}

	async loginStatus(page: Page, context: BrowserContext): Promise<{ loggedIn: boolean; profile: ProfileIdentity }> {
		const pageState = await this.pageUserState(page);
		if (pageState.guest === true) return { loggedIn: false, profile: {} };
		const profile = await this.readProfile(page);
		const hasUserNavigation = (await page.locator(".main-container .user .link-wrapper .channel").count()) > 0;
		const cookies = await context.cookies("https://www.xiaohongshu.com");
		const hasSessionCookie = cookies.some((cookie) => cookie.name === "web_session");
		const loggedIn = loggedInFromSignals({
			guest: pageState.guest,
			hasUserNavigation,
			hasSessionCookie,
			profile,
		});
		return { loggedIn, profile };
	}

	async checkLogin(accountId: string): Promise<{ loggedIn: boolean; username?: string; userId?: string; avatarUrl?: string }> {
		const context = await this.contextFor(accountId);
		const page = await context.newPage();
		try {
			await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
			const status = await this.loginStatus(page, context);
			if (!status.loggedIn) return { loggedIn: false };
			return { loggedIn: true, username: status.profile.nickname, userId: status.profile.userId, avatarUrl: status.profile.avatarUrl };
		} finally {
			await page.close();
		}
	}

	async createLoginSession(): Promise<{ page: Page; context: BrowserContext }> {
		const browser = await this.ensureBrowser();
		const context = await browser.newContext({ locale: "zh-CN" });
		const page = await context.newPage();
		// The login page may keep network requests open indefinitely.  Commit the
		// navigation promptly and let the caller wait for the QR element instead of
		// blocking the whole service request on domcontentloaded.
		await page.goto(`${HOME_URL}explore`, { waitUntil: "commit", timeout: 15_000 }).catch(() => undefined);
		return { page, context };
	}

	async persist(accountId: string, context: BrowserContext): Promise<void> {
		await mkdir(this.dataRoot, { recursive: true });
		await context.storageState({ path: this.store.storagePath(accountId) });
	}

	private async pageFor(accountId: string): Promise<{ context: BrowserContext; page: Page }> {
		const context = await this.contextFor(accountId);
		return { context, page: await context.newPage() };
	}

	private async readInitialState(page: Page): Promise<unknown> {
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const state = await page.evaluate(() =>
				(globalThis as unknown as { __INITIAL_STATE__?: unknown }).__INITIAL_STATE__,
			).catch(() => undefined);
			if (state && typeof state === "object") return state;
			await page.waitForTimeout(300);
		}
		return undefined;
	}

	private async navigateAndReadState(page: Page, url: string): Promise<unknown> {
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
		return this.readInitialState(page);
	}

	private async readStatePath(page: Page, path: readonly string[]): Promise<unknown> {
		return page.evaluate((keys) => {
			let current: unknown = (globalThis as unknown as { __INITIAL_STATE__?: unknown }).__INITIAL_STATE__;
			for (const key of keys) {
				if (!current || typeof current !== "object") return undefined;
				current = (current as Record<string, unknown>)[key];
			}
			if (current && typeof current === "object") {
				const record = current as Record<string, unknown>;
				if ("value" in record) current = record.value;
				else if ("_value" in record) current = record._value;
			}
			return current;
		}, path).catch(() => undefined);
	}

	private async waitForStatePath(page: Page, path: readonly string[], acceptsEmpty = false): Promise<unknown> {
		const deadline = Date.now() + 15_000;
		while (Date.now() < deadline) {
			const value = await this.readStatePath(page, path);
			if (value !== undefined && (acceptsEmpty || !Array.isArray(value) || value.length > 0)) return value;
			await page.waitForTimeout(300);
		}
		throw new Error(`小红书页面状态未加载：${path.join(".")}`);
	}

	async listFeeds(accountId: string): Promise<XiaohongshuPageData> {
		const { page } = await this.pageFor(accountId);
		try {
			await this.navigateAndReadState(page, `${HOME_URL}explore`);
			return await this.waitForStatePath(page, ["feed", "feeds"]);
		} finally {
			await page.close();
		}
	}

	async searchFeeds(accountId: string, keyword: string, filters: SearchFilters = {}): Promise<XiaohongshuPageData> {
		const pending = validateSearchFilters(filters);
		const encoded = encodeURIComponent(keyword.trim());
		const { page } = await this.pageFor(accountId);
		try {
			await this.navigateAndReadState(
				page,
				`${HOME_URL}search_result?keyword=${encoded}&source=web_explore_feed`,
			);
			const beforeIds = await this.searchFeedIds(page);
			if (pending.length > 0) {
				const filter = page.locator("div.filter").first();
				if (await filter.count() === 0) throw new Error("未找到搜索筛选入口");
				await filter.hover();
				const panel = page.locator("div.filter-panel").first();
				await panel.waitFor({ state: "visible", timeout: 8_000 });
				for (const item of pending) {
					const groups = panel.locator("div.filters");
					let selected = false;
					for (let index = 0; index < await groups.count(); index += 1) {
						const group = groups.nth(index);
						if ((await group.locator(":scope > span").first().innerText().catch(() => "")).trim() !== item.label) continue;
						const option = group.locator("div.tags").filter({ hasText: item.option }).first();
						if (await option.count() === 0) throw new Error(`筛选组「${item.label}」没有选项「${item.option}」`);
						await option.click();
						selected = true;
						break;
					}
					if (!selected) throw new Error(`未找到搜索筛选组「${item.label}」`);
				}
				const deadline = Date.now() + 15_000;
				while (Date.now() < deadline) {
					const currentIds = await this.searchFeedIds(page);
					if (currentIds && currentIds !== beforeIds) break;
					await page.waitForTimeout(300);
				}
			}
			return await this.waitForStatePath(page, ["search", "feeds"]);
		} finally {
			await page.close();
		}
	}

	private async searchFeedIds(page: Page): Promise<string> {
		return page.evaluate(() => {
			const feeds = (globalThis as unknown as { __INITIAL_STATE__?: { search?: { feeds?: unknown } } }).__INITIAL_STATE__?.search?.feeds;
			const feedRecord = feeds && typeof feeds === "object" ? feeds as Record<string, unknown> : undefined;
			const value = feedRecord && "value" in feedRecord ? feedRecord.value : feedRecord && "_value" in feedRecord ? feedRecord._value : feeds;
			return Array.isArray(value)
				? value.map((item) => item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>).id : undefined).filter((id): id is string => typeof id === "string").join(",")
				: "";
		}).catch(() => "");
	}

	async feedDetail(accountId: string, feedId: string, xsecToken?: string, options: FeedDetailOptions = {}): Promise<XiaohongshuPageData> {
		const query = xsecToken
			? `?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_feed`
			: "";
		const { page } = await this.pageFor(accountId);
		try {
			await this.navigateAndReadState(
				page,
				`${HOME_URL}explore/${encodeURIComponent(feedId)}${query}`,
			);
			await this.waitForStatePath(page, ["note", "noteDetailMap"]);
			if (options.load_all_comments) {
				const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 20)));
				const speed = options.scroll_speed === "slow" ? 600 : options.scroll_speed === "fast" ? 1_200 : 850;
				for (let round = 0; round < 25; round += 1) {
					if (options.click_more_replies) await this.expandVisibleReplies(page, options.reply_limit);
					const map = await this.readStatePath(page, ["note", "noteDetailMap"]);
					const detail = recordValue(map)?.[feedId];
					const comments = recordValue(recordValue(detail)?.comments);
					const items = Array.isArray(comments?.list) ? comments.list : [];
					if (items.length >= limit || comments?.hasMore !== true) break;
					const scroller = page.locator(".note-scroller, .comments-container").first();
					if (await scroller.count() > 0) {
						await scroller.hover().catch(() => undefined);
						await page.mouse.wheel(0, speed);
					} else {
						await page.mouse.wheel(0, speed);
					}
					await page.waitForTimeout(500);
				}
				if (options.click_more_replies) await this.expandVisibleReplies(page, options.reply_limit);
			}
			const map = await this.readStatePath(page, ["note", "noteDetailMap"]);
			return recordValue(map)?.[feedId];
		} finally {
			await page.close();
		}
	}

	private async expandVisibleReplies(page: Page, configuredLimit?: number): Promise<number> {
		const replyLimit = Math.max(1, Math.min(100, Math.floor(configuredLimit ?? 10)));
		let clicked = 0;
		const buttons = page.locator(".show-more").filter({ hasText: /回复|展开/u });
		for (let index = 0; index < await buttons.count(); index += 1) {
			const button = buttons.nth(index);
			const text = await button.innerText().catch(() => "");
			const count = Number(text.match(/\d+/u)?.[0] ?? 0);
			if (count > replyLimit) continue;
			await button.scrollIntoViewIfNeeded().catch(() => undefined);
			await button.click().catch(() => undefined);
			clicked += 1;
			await page.waitForTimeout(350);
		}
		return clicked;
	}

	async userProfile(accountId: string, userId: string, xsecToken?: string, tab?: string): Promise<XiaohongshuPageData> {
		const params = new URLSearchParams();
		if (xsecToken) {
			params.set("xsec_token", xsecToken);
			params.set("xsec_source", "pc_note");
		}
		if (tab && tab !== "note") {
			params.set("tab", tab);
			params.set("subTab", "note");
		}
		const suffix = params.toString() ? `?${params.toString()}` : "";
		const { page } = await this.pageFor(accountId);
		try {
			const state = await this.navigateAndReadState(
				page,
				`${HOME_URL}user/profile/${encodeURIComponent(userId)}${suffix}`,
			);
			const user = recordValue(stateAt(state, ["user"]));
			if (!user) throw new Error("小红书用户主页状态未加载");
			return {
				basicInfo: valueAtPath(user, ["userPageData"]),
				feeds: unwrapPageValue(user?.notes),
				activeTab: unwrapPageValue(user?.activeTab),
			};
		} finally {
			await page.close();
		}
	}

	async myProfile(accountId: string): Promise<XiaohongshuPageData> {
		const { page } = await this.pageFor(accountId);
		try {
			await page.goto(`${HOME_URL}explore`, { waitUntil: "domcontentloaded", timeout: 45_000 });
			const profile = await this.readProfile(page);
			if (!profile.userId) throw new Error("无法获取当前用户主页 ID");
			const state = await this.navigateAndReadState(
				page,
				`${HOME_URL}user/profile/${encodeURIComponent(profile.userId)}`,
			);
			const user = recordValue(stateAt(state, ["user"]));
			if (!user) throw new Error("小红书个人主页状态未加载");
			return {
				basicInfo: valueAtPath(user, ["userPageData"]),
				feeds: unwrapPageValue(user?.notes),
				activeTab: unwrapPageValue(user?.activeTab),
			};
		} finally {
			await page.close();
		}
	}

	async unreadCount(accountId: string): Promise<XiaohongshuPageData> {
		const { page } = await this.pageFor(accountId);
		try {
			await this.navigateAndReadState(page, `${HOME_URL}explore`);
			return await this.waitForStatePath(page, ["notification", "notificationCount"], true);
		} finally {
			await page.close();
		}
	}

	async notifications(accountId: string, tab: string, limit: number): Promise<XiaohongshuPageData> {
		const { page } = await this.pageFor(accountId);
		try {
			await this.navigateAndReadState(page, `${HOME_URL}notification`);
			const wanted = limit > 0 ? Math.min(100, Math.floor(limit)) : 20;
			for (let round = 0; round < 20; round += 1) {
				const payload = await this.readStatePath(page, ["notification", "notificationMap", tab]);
				const record = recordValue(payload);
				const items = Array.isArray(record?.messageList) ? record.messageList : [];
				if (items.length >= wanted || record?.hasMore !== true) break;
				await page.mouse.wheel(0, 850);
				await page.waitForTimeout(600);
			}
			const payload = await this.waitForStatePath(page, ["notification", "notificationMap", tab], true);
			const record = recordValue(payload);
			if (!record) return payload;
			const items = Array.isArray(record.messageList) ? record.messageList : [];
			return { ...record, messageList: items.slice(0, wanted) };
		} finally {
			await page.close();
		}
	}

	private async detailPage(accountId: string, feedId: string, xsecToken?: string): Promise<Page> {
		const context = await this.contextFor(accountId);
		const page = await context.newPage();
		const query = xsecToken
			? `?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_feed`
			: "";
		await page.goto(`${HOME_URL}explore/${encodeURIComponent(feedId)}${query}`, {
			waitUntil: "domcontentloaded",
			timeout: 45_000,
		});
		await this.waitForStatePath(page, ["note", "noteDetailMap"]);
		return page;
	}

	private async toggleDetailInteraction(
		accountId: string,
		feedId: string,
		xsecToken: string | undefined,
		selector: string,
		field: "liked" | "collected",
		want: boolean,
	): Promise<XiaohongshuPageData> {
		const page = await this.detailPage(accountId, feedId, xsecToken);
		try {
			const button = page.locator(selector).first();
			if (await button.count() === 0) throw new Error(`未找到${field === "liked" ? "点赞" : "收藏"}按钮`);
			const map = await this.waitForStatePath(page, ["note", "noteDetailMap"]);
			const detail = recordValue(map)?.[feedId];
			const note = recordValue(detail)?.note;
			const info = recordValue(note)?.interactInfo;
			const current = recordValue(info)?.[field];
			if (typeof current === "boolean" && current === want) {
				return { feed_id: feedId, success: true, [field]: want, skipped: true };
			}
			await button.click({ timeout: 10_000 });
			const deadline = Date.now() + 8_000;
			while (Date.now() < deadline) {
				const value = await page.evaluate(({ id, key }) => {
					const root = (globalThis as unknown as { __INITIAL_STATE__?: unknown }).__INITIAL_STATE__;
					const state = root && typeof root === "object" ? root as Record<string, unknown> : undefined;
					const note = state?.note;
					const map = note && typeof note === "object" ? (note as Record<string, unknown>).noteDetailMap : undefined;
					const detail = map && typeof map === "object" ? (map as Record<string, unknown>)[id] : undefined;
					const detailRecord = detail && typeof detail === "object" ? detail as Record<string, unknown> : undefined;
					const noteRecord = detailRecord?.note && typeof detailRecord.note === "object" ? detailRecord.note as Record<string, unknown> : undefined;
					const info = noteRecord?.interactInfo && typeof noteRecord.interactInfo === "object" ? noteRecord.interactInfo as Record<string, unknown> : undefined;
					return info?.[key];
				}, { id: feedId, key: field }).catch(() => undefined);
				if (value === want) return { feed_id: feedId, success: true, [field]: want, skipped: false };
				await page.waitForTimeout(350);
			}
			throw new Error(`${field === "liked" ? "点赞" : "收藏"}后未确认状态变化`);
		} finally {
			await page.close();
		}
	}

	async likeFeed(accountId: string, feedId: string, xsecToken?: string, unlike = false): Promise<XiaohongshuPageData> {
		return this.toggleDetailInteraction(accountId, feedId, xsecToken, ".interact-container .left .like-lottie", "liked", !unlike);
	}

	async favoriteFeed(accountId: string, feedId: string, xsecToken?: string, unfavorite = false): Promise<XiaohongshuPageData> {
		return this.toggleDetailInteraction(accountId, feedId, xsecToken, ".interact-container .left .reds-icon.collect-icon", "collected", !unfavorite);
	}

	async postComment(accountId: string, feedId: string, xsecToken: string | undefined, content: string): Promise<XiaohongshuPageData> {
		const page = await this.detailPage(accountId, feedId, xsecToken);
		try {
			const input = page.locator("div.input-box div.content-edit p.content-input").first();
			if (await input.count() === 0) throw new Error("未找到评论输入框");
			await input.fill(content);
			const button = page.locator("div.bottom button.submit").first();
			if (await button.count() === 0) throw new Error("未找到评论发送按钮");
			await button.click();
			const rendered = page.locator(".comments-container").filter({ hasText: content }).first();
			await rendered.waitFor({ state: "visible", timeout: 8_000 });
			return { feed_id: feedId, success: true, content };
		} finally {
			await page.close();
		}
	}

	async replyComment(accountId: string, feedId: string, xsecToken: string | undefined, commentId: string | undefined, userId: string | undefined, content: string): Promise<XiaohongshuPageData> {
		const page = await this.detailPage(accountId, feedId, xsecToken);
		try {
			const comment = await this.findComment(page, commentId, userId);
			const reply = comment.locator(".right .interactions .reply").first();
			if (await reply.count() === 0) throw new Error("未找到评论回复按钮");
			await reply.click();
			const input = page.locator("div.input-box div.content-edit p.content-input").first();
			if (await input.count() === 0) throw new Error("未找到回复输入框");
			await input.fill(content);
			const button = page.locator("div.bottom button.submit").first();
			if (await button.count() === 0) throw new Error("未找到回复发送按钮");
			await button.click();
			await page.locator(".comments-container").filter({ hasText: content }).first().waitFor({ state: "visible", timeout: 8_000 });
			return { feed_id: feedId, success: true, content };
		} finally {
			await page.close();
		}
	}

	private async findComment(page: Page, commentId?: string, userId?: string): Promise<ReturnType<Page["locator"]>> {
		if (!commentId && !userId) throw new Error("缺少 comment_id 或 user_id");
		for (let round = 0; round < 30; round += 1) {
			const comments = page.locator(".comment-item");
			for (let index = 0; index < await comments.count(); index += 1) {
				const candidate = comments.nth(index);
				const id = await candidate.getAttribute("id").catch(() => undefined);
				const candidateUserId = await candidate.getAttribute("data-user-id").catch(() => undefined);
				const nestedUserId = await candidate.locator("[data-user-id]").first().getAttribute("data-user-id").catch(() => undefined);
				if ((commentId && (id === commentId || id === `comment-${commentId}`)) ||
					(userId && (candidateUserId === userId || nestedUserId === userId))) {
					await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
					return candidate;
				}
			}
			const scroller = page.locator(".note-scroller, .comments-container").first();
			await scroller.hover().catch(() => undefined);
			await page.mouse.wheel(0, 900);
			await page.waitForTimeout(450);
		}
		throw new Error("未找到目标评论，评论可能尚未加载或已被删除");
	}

	private async notificationPage(accountId: string): Promise<Page> {
		const context = await this.contextFor(accountId);
		const page = await context.newPage();
		await page.goto(`${HOME_URL}notification`, { waitUntil: "domcontentloaded", timeout: 45_000 });
		await this.waitForStatePath(page, ["notification", "notificationMap", "mentions"], true);
		return page;
	}

	private async notificationItem(page: Page, commentId: string): Promise<{ page: Page; item: ReturnType<Page["locator"]>; index: number }> {
		for (let round = 0; round < 20; round += 1) {
			const payload = await this.waitForStatePath(page, ["notification", "notificationMap", "mentions"], true);
			const messages = recordValue(payload)?.messageList;
			const list = Array.isArray(messages) ? messages : [];
			const index = list.findIndex((value) => recordValue(recordValue(value)?.commentInfo)?.id === commentId);
			if (index >= 0) {
				const item = page.locator(".tabs-content-container > .container").nth(index);
				if (await item.count() > 0 && await item.isVisible().catch(() => false)) return { page, item, index };
			}
			const record = recordValue(payload);
			if (record?.hasMore !== true) break;
			await page.mouse.wheel(0, 850);
			await page.waitForTimeout(600);
		}
		throw new Error(`未找到评论通知 ${commentId}`);
	}

	async likeNotification(accountId: string, commentId: string, unlike = false): Promise<XiaohongshuPageData> {
		const page = await this.notificationPage(accountId);
		try {
			const payload = await this.waitForStatePath(page, ["notification", "notificationMap", "mentions"], true);
			const messages = recordValue(payload)?.messageList;
			const list = Array.isArray(messages) ? messages : [];
			const notification = list.find((value) => recordValue(recordValue(value)?.commentInfo)?.id === commentId);
			const current = recordValue(recordValue(notification)?.commentInfo)?.liked;
			const want = !unlike;
			if (typeof current === "boolean" && current === want) return { comment_id: commentId, success: true, liked: want, skipped: true };
			const { item } = await this.notificationItem(page, commentId);
			const button = item.locator(".action-like .like-wrapper").first();
			if (await button.count() === 0) throw new Error("该通知没有点赞入口");
			await button.click();
			const deadline = Date.now() + 15_000;
			while (Date.now() < deadline) {
				const currentPayload = await this.readStatePath(page, ["notification", "notificationMap", "mentions"]);
				const currentList = recordValue(currentPayload)?.messageList;
				const current = Array.isArray(currentList)
					? currentList.find((value) => recordValue(recordValue(value)?.commentInfo)?.id === commentId)
					: undefined;
				if (recordValue(recordValue(current)?.commentInfo)?.liked === want) {
					return { comment_id: commentId, success: true, liked: want, skipped: false };
				}
				await page.waitForTimeout(700);
			}
			throw new Error(`通知点赞未确认成功：状态未变成 ${want}`);
		} finally {
			await page.close();
		}
	}

	async replyNotification(accountId: string, commentId: string, content: string): Promise<XiaohongshuPageData> {
		const page = await this.notificationPage(accountId);
		try {
			const { item } = await this.notificationItem(page, commentId);
			const reply = item.locator(".action-reply").first();
			if (await reply.count() === 0) throw new Error("该通知没有回复入口");
			await reply.click();
			const input = item.locator("textarea.comment-input").first();
			await input.fill(content);
			const submit = item.locator("button.submit").first();
			if (await submit.count() === 0) throw new Error("未找到通知回复发送按钮");
			await submit.click();
			await input.waitFor({ state: "hidden", timeout: 8_000 });
			return { comment_id: commentId, success: true, content };
		} finally {
			await page.close();
		}
	}

	private async publishPage(accountId: string): Promise<Page> {
		const context = await this.contextFor(accountId);
		const page = await context.newPage();
		await page.goto(CREATOR_PUBLISH_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
		await page.locator("div.upload-content, input[type='file']").first().waitFor({ state: "visible", timeout: 20_000 });
		return page;
	}

	private async fillPublishForm(page: Page, title: string, content: string, files: string[], options: PublishOptions): Promise<void> {
		validatePublishText(title, content);
		const normalizedOptions = normalizePublishOptions(options);
		const input = page.locator("input[type='file']").first();
		if (await input.count() === 0) throw new Error("未找到发布页文件上传入口");
		await input.setInputFiles(files);
		const titleInput = page.locator("div.d-input input").first();
		if (await titleInput.count() === 0) throw new Error("未找到发布标题输入框");
		await titleInput.fill(title);
		const titleError = page.locator("div.title-container div.max_suffix").first();
		if (await titleError.count() > 0 && await titleError.isVisible().catch(() => false)) throw new Error("标题超过小红书允许的长度");
		const editor = page.locator(`div[role="textbox"][contenteditable="true"], div.tiptap[contenteditable="true"], div.ql-editor, [contenteditable='true'], textarea`).first();
		if (await editor.count() === 0) throw new Error("未找到发布正文输入框");
		await editor.fill(content);
		for (const tag of normalizedOptions.tags ?? []) {
			const normalized = tag.trim().replace(/^#/u, "");
			if (!normalized) continue;
			await editor.press("#");
			await editor.pressSequentially(normalized);
			const suggestion = page.locator("#creator-editor-topic-container .item").first();
			if (await suggestion.count() > 0) await suggestion.click();
			else await editor.press(" ");
		}
		if (normalizedOptions.visibility && normalizedOptions.visibility !== "公开可见") {
			const dropdown = page.locator("div.permission-card-wrapper div.d-select-content").first();
			if (await dropdown.count() === 0) throw new Error("未找到可见范围设置");
			await dropdown.click();
			const option = page.locator("div.d-options-wrapper div.d-grid-item div.custom-option").filter({ hasText: normalizedOptions.visibility }).first();
			if (await option.count() === 0) throw new Error(`未找到可见范围「${normalizedOptions.visibility}」`);
			await option.click();
		}
		if (normalizedOptions.schedule_at) {
			const when = new Date(normalizedOptions.schedule_at);
			const toggle = page.locator(".post-time-wrapper .d-switch").first();
			if (await toggle.count() === 0) throw new Error("未找到定时发布开关");
			await toggle.click();
			const dateInput = page.locator(".date-picker-container input").first();
			if (await dateInput.count() === 0) throw new Error("未找到定时发布时间输入框");
			const pad = (value: number) => String(value).padStart(2, "0");
			await dateInput.fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}:${pad(when.getMinutes())}`);
		}
		if (normalizedOptions.is_original) {
			const card = page.locator("div.custom-switch-card").filter({ hasText: "原创声明" }).first();
			const toggle = card.locator("div.d-switch").first();
			if (await toggle.count() === 0) throw new Error("未找到原创声明设置");
			const checked = await toggle.locator("input[type='checkbox']").isChecked().catch(() => false);
			if (!checked) {
				await toggle.click();
				const footer = page.locator("div.footer").filter({ hasText: "原创声明须知" }).first();
				const checkbox = footer.locator("div.d-checkbox").first();
				if (await checkbox.count() > 0) await checkbox.click();
				const confirm = page.locator("div.footer").filter({ hasText: "声明原创" }).locator("button.custom-button").first();
				if (await confirm.count() === 0) throw new Error("未找到原创声明确认按钮");
				await confirm.click();
			}
		}
		if ((normalizedOptions.products ?? []).length > 0) {
			const addProduct = page.locator("span.d-text").filter({ hasText: "添加商品" }).first();
			if (await addProduct.count() === 0) throw new Error("未找到添加商品入口，账号可能未开通商品功能");
			await addProduct.click();
			const modal = page.locator(".multi-goods-selector-modal").first();
			await modal.waitFor({ state: "visible", timeout: 10_000 });
			const failed: string[] = [];
			for (const keyword of normalizedOptions.products ?? []) {
				const search = modal.locator("input[placeholder='搜索商品ID 或 商品名称']").first();
				if (await search.count() === 0) throw new Error("未找到商品搜索框");
				await search.fill(keyword);
				await search.press("Enter");
				const checkbox = modal.locator(".goods-list-normal .good-card-container .d-checkbox").first();
				try {
					await checkbox.waitFor({ state: "visible", timeout: 10_000 });
					await checkbox.click();
				} catch {
					failed.push(keyword);
				}
			}
			const save = modal.locator(".goods-selected-footer button, .goods-selected-footer .d-button--primary").first();
			if (await save.count() > 0) await save.click();
			if (failed.length > 0) throw new Error(`部分商品未找到：${failed.join("、")}`);
		}
	}

	private async submitPublishPage(page: Page): Promise<void> {
		const button = page.locator("xhs-publish-btn, .publish-page-publish-btn button.bg-red").first();
		if (await button.count() === 0) throw new Error("未找到发布按钮");
		await button.click({ timeout: 10_000 });
		await page.waitForTimeout(2_000);
		if (page.url().includes("/publish/publish")) throw new Error("发布后页面未离开发布页，未确认发布成功");
	}

	async publishContent(accountId: string, title: string, content: string, images: string[], options: PublishOptions = {}): Promise<XiaohongshuPageData> {
		if (images.length === 0) throw new Error("至少需要一张图片");
		validatePublishText(title, content);
		const resolved = await resolveImageInputs(this.dataRoot, images);
		const page = await this.publishPage(accountId);
		try {
			await this.fillPublishForm(page, title, content, resolved.files, options);
			await this.submitPublishPage(page);
			return { success: true, title, image_count: resolved.files.length };
		} finally {
			await page.close();
			await resolved.cleanup();
		}
	}

	async publishVideo(accountId: string, title: string, content: string, video: string, options: PublishOptions = {}): Promise<XiaohongshuPageData> {
		if (!video || !existsSync(video)) throw new Error("视频必须是存在的本地文件路径");
		validatePublishText(title, content);
		const page = await this.publishPage(accountId);
		try {
			const videoTab = page.locator("div.creator-tab").filter({ hasText: "上传视频" }).first();
			if (await videoTab.count() > 0) await videoTab.click();
			await this.fillPublishForm(page, title, content, [video], options);
			await this.submitPublishPage(page);
			return { success: true, title, video };
		} finally {
			await page.close();
		}
	}

	async removeAccount(accountId: string): Promise<void> {
		const context = this.contexts.get(accountId);
		if (context) {
			await context.close();
			this.contexts.delete(accountId);
		}
		await this.store.remove(accountId);
	}

	async close(): Promise<void> {
		await Promise.all([...this.contexts.values()].map((context) => context.close()));
		this.contexts.clear();
		await this.browser?.close();
		this.browser = undefined;
	}
}
