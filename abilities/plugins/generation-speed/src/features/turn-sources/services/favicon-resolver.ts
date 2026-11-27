import { getPluginContext } from "../../../plugin-context";

/** 首页 HTML 只读这么多，图标声明都在 <head> 里。 */
const MAX_HTML_CHARS = 200_000;
const REQUEST_TIMEOUT_MS = 8_000;
/** 成功的图标缓存一小时，失败的五分钟后可重试。 */
const SUCCESS_TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED = 128;
const IMAGE_TYPE = /^image\/(?:png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon|svg\+xml)$/;

/**
 * 从首页 HTML 里找站点声明的图标（`<link rel="icon">`、`apple-touch-icon`），
 * 最多取 3 个，再补上约定俗成的 `/favicon.ico`。与 Vetta 自己给链接配图标的口径一致。
 */
export function discoverIconUrls(html: string, page: URL): URL[] {
	const document = new DOMParser().parseFromString(html.slice(0, MAX_HTML_CHARS), "text/html");
	let base = page;
	const declaredBase = document.querySelector("base[href]")?.getAttribute("href");
	if (declaredBase) {
		try {
			base = new URL(declaredBase, page);
		} catch {
			/* 无效的 base 忽略。 */
		}
	}
	const urls: URL[] = [];
	for (const link of document.querySelectorAll("link[rel][href]")) {
		if (!/(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/i.test(link.getAttribute("rel") ?? "")) continue;
		try {
			const url = new URL(link.getAttribute("href") ?? "", base);
			if (/^https?:$/.test(url.protocol) && !urls.some((known) => known.href === url.href)) urls.push(url);
		} catch {
			/* 写坏的图标地址忽略。 */
		}
		if (urls.length >= 3) break;
	}
	const conventional = new URL("/favicon.ico", page);
	if (!urls.some((known) => known.href === conventional.href)) urls.push(conventional);
	return urls;
}

function headerValue(headers: Record<string, string>, name: string): string {
	const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
	return key ? headers[key] : "";
}

async function fetchIcon(origin: string): Promise<string | null> {
	const network = getPluginContext()?.network;
	if (!network) return null;
	let candidates = [new URL("/favicon.ico", origin)];
	try {
		const page = await network.request<string>({ url: origin, responseType: "text", timeoutMs: REQUEST_TIMEOUT_MS });
		if (page.ok && /^text\/html/i.test(headerValue(page.headers, "content-type")) && typeof page.body === "string") {
			candidates = discoverIconUrls(page.body, new URL(origin));
		}
	} catch {
		/* 首页打不开时只试 /favicon.ico。 */
	}
	for (const candidate of candidates) {
		try {
			const response = await network.request<string>({
				url: candidate.href,
				responseType: "base64",
				timeoutMs: REQUEST_TIMEOUT_MS,
			});
			const type = headerValue(response.headers, "content-type").split(";", 1)[0].trim().toLowerCase();
			if (response.ok && IMAGE_TYPE.test(type) && typeof response.body === "string" && response.body.length > 0) {
				return `data:${type};base64,${response.body}`;
			}
		} catch {
			/* 试下一个声明的图标。 */
		}
	}
	return null;
}

const cache = new Map<string, { expires: number; value: Promise<string | null> }>();

/**
 * 取站点图标并转成 data URL（宿主主进程代为请求，不依赖页面能否加载外部图片）。
 * 同一站点并发调用共用一次请求；结果按成功 / 失败分别缓存。
 */
export function resolveFavicon(domain: string): Promise<string | null> {
	const origin = `https://${domain}`;
	const cached = cache.get(origin);
	if (cached && cached.expires > Date.now()) return cached.value;

	const value = fetchIcon(origin).catch(() => null);
	cache.set(origin, { expires: Date.now() + SUCCESS_TTL_MS, value });
	void value.then((icon) => {
		if (!icon) cache.set(origin, { expires: Date.now() + FAILURE_TTL_MS, value });
	});
	if (cache.size > MAX_CACHED) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	return value;
}

/** 仅测试用：清空缓存。 */
export function clearFaviconCache(): void {
	cache.clear();
}
