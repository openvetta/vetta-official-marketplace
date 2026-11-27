import { describe, expect, it, vi } from "vitest";
import {
	domainOf,
	extractReplyLinks,
	latestReplyText,
	mergeSources,
	normalizeUrl,
	urlsFromToolArgs,
} from "../domain/turn-sources";
import { FetchedPagesStore } from "../features/turn-sources/services/fetched-pages-store";

describe("turn sources", () => {
	it("normalizes http(s) URLs, strips fragments and trailing punctuation, rejects other schemes", () => {
		expect(normalizeUrl("https://a.dev/x#part.")).toBe("https://a.dev/x");
		expect(normalizeUrl("https://a.dev/文档，")).toBe("https://a.dev/%E6%96%87%E6%A1%A3");
		expect(normalizeUrl("file:///etc/passwd")).toBeNull();
		expect(normalizeUrl("not a url")).toBeNull();
		expect(domainOf("https://www.example.com/a")).toBe("example.com");
	});

	it("takes only the latest turn's assistant text", () => {
		const text = latestReplyText([
			{ id: "1", role: "user", text: "old" },
			{ id: "2", role: "assistant", text: "old reply https://old.dev" },
			{ id: "3", role: "user", text: "new" },
			{ id: "4", role: "assistant", text: "part one" },
			{ id: "5", role: "assistant", text: "part two" },
		]);
		expect(text).toBe("part one\npart two");
	});

	it("extracts Markdown links with titles and bare URLs, ignoring code", () => {
		const links = extractReplyLinks(
			"Read [Guide](https://a.dev/guide) and https://b.dev/post.\n```\ncurl https://c.dev/api\n```\nAlso `https://d.dev`. Again https://a.dev/guide",
		);
		expect(links).toEqual([
			{ url: "https://a.dev/guide", title: "Guide", origin: "reply" },
			{ url: "https://b.dev/post", title: null, origin: "reply" },
		]);
	});

	it("reads URLs from common tool argument keys", () => {
		expect(urlsFromToolArgs({ url: "https://a.dev", urls: ["https://b.dev", 3, "https://a.dev"], query: "x" })).toEqual([
			"https://a.dev/",
			"https://b.dev/",
		]);
		expect(urlsFromToolArgs(undefined)).toEqual([]);
	});

	it("puts cited links first and appends fetched pages that were not cited", () => {
		const merged = mergeSources([{ url: "https://a.dev/", title: "A", origin: "reply" }], ["https://a.dev/", "https://b.dev/"]);
		expect(merged).toEqual([
			{ url: "https://a.dev/", title: "A", origin: "reply" },
			{ url: "https://b.dev/", title: null, origin: "fetched" },
		]);
	});
});

describe("fetched pages store", () => {
	it("keeps pages per conversation and clears them when the user sends a new message", () => {
		const store = new FetchedPagesStore();
		const listener = vi.fn();
		store.subscribe(listener);

		store.handle({ type: "conversation-changed", conversation: { id: "s1" } as never });
		store.handle({ type: "tool-call-start", toolCallId: "t1", toolName: "web_fetch", args: { url: "https://a.dev" } });
		expect(store.getSnapshot()).toEqual(["https://a.dev/"]);

		store.handle({ type: "conversation-changed", conversation: { id: "s2" } as never });
		expect(store.getSnapshot()).toEqual([]);
		store.handle({ type: "conversation-changed", conversation: { id: "s1" } as never });
		expect(store.getSnapshot()).toEqual(["https://a.dev/"]);

		store.handle({ type: "message-added", message: { id: "u", role: "user", text: "next" } });
		expect(store.getSnapshot()).toEqual([]);
		expect(listener).toHaveBeenCalled();
	});
});
