import type { ConversationMessage } from "@vetta-org/plugin-sdk";

/** 本轮回复的一个来源。 */
export interface TurnSource {
	url: string;
	/** 回复里 Markdown 链接的文字；没有时为 null。 */
	title: string | null;
	/** 回复正文引用的，还是工具打开过的。两者都有时记为 `reply`。 */
	origin: "reply" | "fetched";
}

const MARKDOWN_LINK = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL = /https?:\/\/[^\s<>()\[\]"'`]+/g;
/** 句末标点常被正则吞进网址。 */
const TRAILING_PUNCTUATION = /[.,;:!?，。；：！？、]+$/;
/** 工具参数里可能放网址的键。 */
const URL_ARG_KEYS = ["url", "urls", "href", "link", "links"];

/** 只接受 http(s)；去掉片段标识与句末标点，便于去重。 */
export function normalizeUrl(raw: string): string | null {
	const trimmed = raw.trim().replace(TRAILING_PUNCTUATION, "");
	try {
		const url = new URL(trimmed);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		url.hash = "";
		return url.toString();
	} catch {
		return null;
	}
}

/** 显示用域名，去掉 `www.`。 */
export function domainOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** 最新一轮的回复正文：最后一条用户消息之后的所有助手消息。 */
export function latestReplyText(messages: readonly ConversationMessage[]): string {
	let start = 0;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (messages[index].role === "user") {
			start = index + 1;
			break;
		}
	}
	return messages
		.slice(start)
		.filter((message) => message.role === "assistant")
		.map((message) => message.text)
		.join("\n");
}

/** 回复正文里的链接：先取 Markdown 链接（带标题），再补裸网址。代码块里的不算。 */
export function extractReplyLinks(text: string): TurnSource[] {
	const prose = text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
	const found = new Map<string, TurnSource>();
	for (const match of prose.matchAll(MARKDOWN_LINK)) {
		const url = normalizeUrl(match[2]);
		if (url && !found.has(url)) found.set(url, { url, title: match[1].trim(), origin: "reply" });
	}
	const withoutMarkdownLinks = prose.replace(MARKDOWN_LINK, " ");
	for (const match of withoutMarkdownLinks.matchAll(BARE_URL)) {
		const url = normalizeUrl(match[0]);
		if (url && !found.has(url)) found.set(url, { url, title: null, origin: "reply" });
	}
	return [...found.values()];
}

/** 工具调用参数里的网址（如 web_fetch 的 `url`）。 */
export function urlsFromToolArgs(args: Record<string, unknown> | undefined): string[] {
	if (!args) return [];
	const urls: string[] = [];
	for (const key of URL_ARG_KEYS) {
		const value = args[key];
		const candidates = Array.isArray(value) ? value : [value];
		for (const candidate of candidates) {
			if (typeof candidate !== "string") continue;
			const url = normalizeUrl(candidate);
			if (url && !urls.includes(url)) urls.push(url);
		}
	}
	return urls;
}

/** 合并：回复引用的在前（保留标题），再接工具打开过但回复没引用的。 */
export function mergeSources(replyLinks: readonly TurnSource[], fetchedUrls: readonly string[]): TurnSource[] {
	const merged = new Map<string, TurnSource>();
	for (const link of replyLinks) merged.set(link.url, link);
	for (const url of fetchedUrls) {
		if (!merged.has(url)) merged.set(url, { url, title: null, origin: "fetched" });
	}
	return [...merged.values()];
}
