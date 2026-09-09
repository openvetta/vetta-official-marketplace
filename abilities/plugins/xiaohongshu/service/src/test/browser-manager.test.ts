import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	arrayAtPath,
	detailAtPath,
	ensureChromiumExecutable,
	loggedInFromSignals,
	normalizePublishOptions,
	profileIdentityFromValue,
	validatePublishText,
	xiaohongshuTitleLength,
	unwrapPageValue,
} from "../browser/browser-manager.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "xhs-browser-test-"));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ensureChromiumExecutable", () => {
	it("matches the upstream title length calculation", () => {
		expect(xiaohongshuTitleLength("你好世界")).toBe(4);
		expect(xiaohongshuTitleLength("hello")).toBe(3);
		expect(xiaohongshuTitleLength("😀")).toBe(2);
		expect(xiaohongshuTitleLength("一二三四五六七八九十一二三四五六七八九十")).toBe(20);
	});

	it("validates publish text and normalizes publish options", () => {
		expect(() => validatePublishText("", "正文")).toThrow("标题不能为空");
		expect(() => validatePublishText("一".repeat(21), "正文")).toThrow("20 字限制");
		expect(() => validatePublishText("标题", "x".repeat(1001))).toThrow("1000 字限制");
		const now = Date.parse("2026-09-09T00:00:00+08:00");
		expect(normalizePublishOptions({
			tags: ["#旅行", "", "#美食"],
			visibility: "公开可见",
			schedule_at: "2026-09-09T02:00:00+08:00",
		}, now)).toMatchObject({ tags: ["旅行", "美食"], visibility: "公开可见" });
		expect(() => normalizePublishOptions({ schedule_at: "2026-09-09T00:30:00+08:00" }, now)).toThrow("至少在 1 小时后");
		expect(() => normalizePublishOptions({ schedule_at: "2026-09-24T00:00:00+08:00" }, now)).toThrow("不能超过 14 天");
	});

	it("extracts the state shapes used by feed and detail pages", () => {
		const state = {
			feed: { feeds: { value: [{ id: "feed-1" }, { id: "feed-2" }] } },
			note: { noteDetailMap: { "feed-1": { note: { title: "测试" } } } },
		};
		expect(arrayAtPath(state, ["feed", "feeds"])).toEqual([{ id: "feed-1" }, { id: "feed-2" }]);
		expect(detailAtPath(state, "feed-1")).toEqual({ note: { title: "测试" } });
		expect(unwrapPageValue({ _value: [{ id: "feed-3" }] })).toEqual([{ id: "feed-3" }]);
	});

	it("does not treat a placeholder profile nickname as a login", () => {
		expect(loggedInFromSignals({
			profile: { nickname: "小红书账号" },
			hasUserNavigation: false,
			hasSessionCookie: false,
		})).toBe(false);
	});

	it("accepts an explicit logged-in identity when navigation has not rendered", () => {
		expect(loggedInFromSignals({
			guest: false,
			profile: { nickname: "花酒", userId: "u-8023" },
			hasUserNavigation: false,
			hasSessionCookie: false,
		})).toBe(true);
	});
	it("extracts identity fields from the different upstream state shapes", () => {
		expect(profileIdentityFromValue({
			user: { userInfo: { value: { nickname: " 花酒 ", userId: "u-8023", avatar: "https://img.example/avatar.png" } } },
		})).toEqual({ nickname: "花酒", userId: "u-8023", avatarUrl: "https://img.example/avatar.png" });
	});

	it("normalizes avatar arrays and image objects without using navigation labels", () => {
		expect(profileIdentityFromValue({
			user: {
				userInfo: {
					value: {
						nickname: "哈米vvv",
						userId: "68ee46a50000000037032877",
						images: [{ url: "https://sns-avatar.example/avatar.webp" }],
					},
				},
			},
			channel: "我",
		})).toEqual({
			nickname: "哈米vvv",
			userId: "68ee46a50000000037032877",
			avatarUrl: "https://sns-avatar.example/avatar.webp",
		});
	});

	it("reuses an executable already present in the account service cache", async () => {
		const cacheDir = await temporaryDirectory();
		const executable = join(cacheDir, "chromium", "chrome.exe");
		await mkdir(join(cacheDir, "chromium"), { recursive: true });
		await writeFile(executable, "browser");
		const install = vi.fn(async () => undefined);

		await expect(ensureChromiumExecutable({
			cacheDir,
			cliPath: "playwright-cli.js",
			install,
			locate: async (directory) => executable.startsWith(directory) ? executable : undefined,
		})).resolves.toBe(executable);
		expect(install).not.toHaveBeenCalled();
	});

	it("downloads Chromium into the requested cache when it is missing", async () => {
		const cacheDir = await temporaryDirectory();
		const executable = join(cacheDir, "chromium", "chrome.exe");
		const install = vi.fn(async (_cliPath: string, directory: string) => {
			await mkdir(join(directory, "chromium"), { recursive: true });
			await writeFile(executable, "browser");
		});

		await expect(ensureChromiumExecutable({
			cacheDir,
			cliPath: "playwright-cli.js",
			install,
			locate: async (directory) => directory === cacheDir && (await import("node:fs")).existsSync(executable) ? executable : undefined,
		})).resolves.toBe(executable);
		expect(install).toHaveBeenCalledOnce();
		expect(install).toHaveBeenCalledWith("playwright-cli.js", cacheDir);
	});

	it("shares one download across concurrent requests for the same cache", async () => {
		const cacheDir = await temporaryDirectory();
		const executable = join(cacheDir, "chromium.exe");
		let release!: () => void;
		const install = vi.fn(async (_cliPath: string, directory: string) => {
			await new Promise<void>((resolve) => { release = resolve; });
			await writeFile(join(directory, "chromium.exe"), "browser");
		});
		const locate = async (directory: string) => (await import("node:fs")).existsSync(executable) ? executable : undefined;

		const first = ensureChromiumExecutable({ cacheDir, cliPath: "playwright-cli.js", install, locate });
		const second = ensureChromiumExecutable({ cacheDir, cliPath: "playwright-cli.js", install, locate });
		await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
		release();
		await expect(Promise.all([first, second])).resolves.toEqual([executable, executable]);
	});

	it("honors a valid explicit executable override and rejects a missing one", async () => {
		const cacheDir = await temporaryDirectory();
		const executable = join(cacheDir, "custom-browser.exe");
		await writeFile(executable, "browser");

		await expect(ensureChromiumExecutable({ cacheDir, executableOverride: executable })).resolves.toBe(executable);
		await expect(ensureChromiumExecutable({ cacheDir, executableOverride: join(cacheDir, "missing.exe") })).rejects.toThrow("XHS_BROWSER_EXECUTABLE does not exist");
	});

	it("never resolves an executable from a different cache directory", async () => {
		const firstCache = await temporaryDirectory();
		const secondCache = await temporaryDirectory();
		const firstExecutable = join(firstCache, "chrome.exe");
		await writeFile(firstExecutable, "browser");

		await expect(ensureChromiumExecutable({
			cacheDir: secondCache,
			cliPath: "playwright-cli.js",
			install: async () => undefined,
			locate: async (directory) => directory === firstCache ? firstExecutable : undefined,
		})).rejects.toThrow("no executable was found");
	});
});
