import type { PluginContext } from "@vetta-org/plugin-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearFaviconCache, discoverIconUrls, resolveFavicon } from "../features/turn-sources/services/favicon-resolver";
import { setPluginContext } from "../plugin-context";

afterEach(() => {
	clearFaviconCache();
	setPluginContext(null);
});

describe("favicon resolver", () => {
	it("finds declared icons relative to <base>, then falls back to /favicon.ico", () => {
		const urls = discoverIconUrls(
			'<base href="/assets/"><link rel="stylesheet" href="a.css"><link rel="shortcut icon" href="fav.svg"><link rel="apple-touch-icon" href="https://cdn.x.dev/t.png">',
			new URL("https://x.dev/"),
		);
		expect(urls.map((url) => url.href)).toEqual([
			"https://x.dev/assets/fav.svg",
			"https://cdn.x.dev/t.png",
			"https://x.dev/favicon.ico",
		]);
	});

	it("returns a data URL for the first icon that is a real image and shares one request per site", async () => {
		const request = vi.fn(async ({ url }: { url: string }) => {
			if (url === "https://x.dev") return { ok: true, status: 200, statusText: "", headers: { "content-type": "text/html; charset=utf-8" }, body: '<link rel="icon" href="/broken.png">' };
			if (url === "https://x.dev/broken.png") return { ok: true, status: 200, statusText: "", headers: { "content-type": "text/html" }, body: "PGh0bWw+" };
			return { ok: true, status: 200, statusText: "", headers: { "content-type": "image/x-icon" }, body: "AAAB" };
		});
		setPluginContext({ network: { request } } as unknown as PluginContext);

		const [first, second] = await Promise.all([resolveFavicon("x.dev"), resolveFavicon("x.dev")]);
		expect(first).toBe("data:image/x-icon;base64,AAAB");
		expect(second).toBe(first);
		expect(request).toHaveBeenCalledTimes(3);
	});

	it("gives up quietly when the site cannot be reached", async () => {
		setPluginContext({ network: { request: vi.fn(async () => { throw new Error("offline"); }) } } as unknown as PluginContext);
		await expect(resolveFavicon("down.dev")).resolves.toBeNull();
	});
});
