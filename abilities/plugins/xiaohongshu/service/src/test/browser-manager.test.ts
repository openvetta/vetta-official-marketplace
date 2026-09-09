import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureChromiumExecutable, profileIdentityFromValue } from "../browser/browser-manager.js";

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
	it("extracts identity fields from the different upstream state shapes", () => {
		expect(profileIdentityFromValue({
			user: { userInfo: { value: { nickname: " 花酒 ", userId: "u-8023", avatar: "https://img.example/avatar.png" } } },
		})).toEqual({ nickname: "花酒", userId: "u-8023", avatarUrl: "https://img.example/avatar.png" });
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
