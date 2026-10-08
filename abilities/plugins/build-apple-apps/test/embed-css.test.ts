import { describe, expect, it } from "vitest";
import { buildEmbedCss, FALLBACK_PAGE_BACKGROUND, readHostBackground } from "../src/runtime/embed-css.js";

describe("buildEmbedCss", () => {
	it("repaints only the page background with the host color", () => {
		const css = buildEmbedCss("#ffffff");
		expect(css).toContain("--color-page: #ffffff !important");
	});

	it("hides the brand link that would navigate the panel away", () => {
		expect(buildEmbedCss("#000")).toContain('a[aria-label="Open serve-sim"] { display: none !important; }');
	});
});

describe("readHostBackground", () => {
	it("reads the inherited host token from the plugin's own node", () => {
		const node = document.createElement("div");
		node.style.setProperty("--background", " #fafafa ");
		document.body.appendChild(node);
		expect(readHostBackground(node)).toBe("#fafafa");
		node.remove();
	});

	it("falls back to serve-sim's own page color when the token is missing", () => {
		expect(readHostBackground(null)).toBe(FALLBACK_PAGE_BACKGROUND);
		const node = document.createElement("div");
		document.body.appendChild(node);
		expect(readHostBackground(node)).toBe(FALLBACK_PAGE_BACKGROUND);
		node.remove();
	});
});
