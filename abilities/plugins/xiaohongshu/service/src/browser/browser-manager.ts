import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { AccountStore } from "../accounts/account-store.js";

const HOME_URL = "https://www.xiaohongshu.com/";

export class BrowserManager {
	private browser?: Browser;
	private readonly contexts = new Map<string, BrowserContext>();

	constructor(private readonly store: AccountStore, private readonly dataRoot: string) {}

	private async ensureBrowser(): Promise<Browser> {
		if (this.browser) return this.browser;
		this.browser = await chromium.launch({
			headless: process.env.XHS_HEADLESS !== "false",
			executablePath: process.env.XHS_BROWSER_EXECUTABLE,
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

	async checkLogin(accountId: string): Promise<{ loggedIn: boolean; username?: string }> {
		const context = await this.contextFor(accountId);
		const page = await context.newPage();
		try {
			await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
			const cookies = await context.cookies("https://www.xiaohongshu.com");
			const loggedIn = (await page.locator("[class*='avatar'], [class*='user-avatar']").count()) > 0 || cookies.length > 0;
			return { loggedIn };
		} finally {
			await page.close();
		}
	}

	async createLoginSession(): Promise<{ page: Page; context: BrowserContext }> {
		const browser = await this.ensureBrowser();
		const context = await browser.newContext({ locale: "zh-CN" });
		const page = await context.newPage();
		await page.goto(`${HOME_URL}explore`, { waitUntil: "domcontentloaded", timeout: 30_000 });
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
