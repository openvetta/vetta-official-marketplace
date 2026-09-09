import { existsSync } from "node:fs";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { AccountStore } from "../accounts/account-store.js";

const HOME_URL = "https://www.xiaohongshu.com/";
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

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
		avatarUrl: first(["avatar", "avatarUrl", "avatar_url", "image", "images"]),
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

	async readProfile(page: Page): Promise<ProfileIdentity> {
		const state = await page.evaluate(() => {
			const root = (globalThis as unknown as { __INITIAL_STATE__?: unknown }).__INITIAL_STATE__;
			const record = root && typeof root === "object" ? root as Record<string, unknown> : undefined;
			const user = record?.user;
			if (!user || typeof user !== "object") return undefined;
			const userRecord = user as Record<string, unknown>;
			const info = userRecord.userInfo;
			if (info && typeof info === "object" && "value" in info) return (info as Record<string, unknown>).value;
			return info;
		}).catch(() => undefined);
		const identity = profileIdentityFromValue(state);
		if (identity.nickname && identity.userId && identity.avatarUrl) return identity;

		const nickname = identity.nickname ?? stringValue(await page.locator(".main-container .user .link-wrapper .channel").first().textContent().catch(() => undefined));
		const avatarUrl = identity.avatarUrl ?? stringValue(await page.locator(".main-container .user .link-wrapper img, .main-container .user img.avatar, img[class*='avatar']").first().getAttribute("src").catch(() => undefined));
		return { ...identity, nickname, avatarUrl };
	}

	async checkLogin(accountId: string): Promise<{ loggedIn: boolean; username?: string; userId?: string; avatarUrl?: string }> {
		const context = await this.contextFor(accountId);
		const page = await context.newPage();
		try {
			await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
			const cookies = await context.cookies("https://www.xiaohongshu.com");
			const loggedIn = (await page.locator(".main-container .user .link-wrapper .channel").count()) > 0 || cookies.some((cookie) => cookie.name === "web_session");
			if (!loggedIn) return { loggedIn: false };
			const profile = await this.readProfile(page);
			return { loggedIn, username: profile.nickname, userId: profile.userId, avatarUrl: profile.avatarUrl };
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

	async close(): Promise<void> {
		await Promise.all([...this.contexts.values()].map((context) => context.close()));
		this.contexts.clear();
		await this.browser?.close();
		this.browser = undefined;
	}
}
