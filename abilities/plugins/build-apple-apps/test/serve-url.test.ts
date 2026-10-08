import { describe, expect, it } from "vitest";
import { buildPreviewUrl } from "../src/runtime/serve-url.js";

describe("buildPreviewUrl", () => {
	it("points at the preview page on IPv4 loopback", () => {
		expect(buildPreviewUrl(51234)).toBe("http://127.0.0.1:51234/");
	});
});
