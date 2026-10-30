import { describe, expect, it } from "vitest";
import {
	describeProbe,
	describeResponse,
	extractAnchors,
	fingerprint,
	isReaServer,
	normalizeToolFailure,
	normalizeToolResponse,
	shortToolName,
	stableStringify,
} from "../domain/evidence-normalizer";

describe("tool naming", () => {
	it("strips the host's MCP prefixes", () => {
		expect(shortToolName("mcp__rea__binary_session")).toBe("binary_session");
		expect(shortToolName("mcp_rea_inspect_wasm_artifact")).toBe("inspect_wasm_artifact");
		expect(shortToolName("binary_session")).toBe("binary_session");
	});

	it("recognises REA tools across client naming conventions", () => {
		expect(isReaServer("rea", "mcp__rea__binary_session")).toBe(true);
		expect(isReaServer(undefined, "mcp_rea_binary_session")).toBe(true);
		expect(isReaServer("notion", "mcp__notion__search")).toBe(false);
	});
});

describe("fingerprints", () => {
	it("ignores key order", () => {
		expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
		expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
	});

	it("changes when the payload changes", () => {
		expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
		expect(fingerprint({ a: 1 })).toMatch(/^[0-9a-f]{16}$/u);
	});
});

describe("observations", () => {
	it("turns a session response into one readable line", () => {
		expect(describeResponse("binary_session", { status: "ready", arch: "arm64" })).toBe(
			"binary_session → ready",
		);
		expect(describeResponse("list_modules", [{ id: 1 }, { id: 2 }])).toContain("2 items");
	});

	it("marks a returned payload as confirmed and an error as unknown", () => {
		const ok = normalizeToolResponse("binary_session", { status: "ready", sessionId: "s1" });
		expect(ok.grade).toBe("confirmed");
		expect(ok.failed).toBe(false);
		const bad = normalizeToolResponse("binary_session", { error: "no session" });
		expect(bad.grade).toBe("unknown");
		expect(bad.failed).toBe(true);
		const failed = normalizeToolFailure("binary_session", "process exited");
		expect(failed.grade).toBe("unknown");
		expect(failed.claim).toContain("process exited");
	});

	it("collects file and symbol pointers from nested responses", () => {
		const anchors = extractAnchors({
			modules: [
				{ path: "app.asar:/src/export.ts", line: 1188, symbol: "exportPDF" },
				{ path: "/usr/lib/libpdf.dylib", symbol: "PDFKitInit" },
			],
			meta: { note: "no pointer here" },
		});
		expect(anchors).toHaveLength(2);
		expect(anchors[0]).toMatchObject({ file: "app.asar:/src/export.ts", line: 1188, symbol: "exportPDF" });
	});

	it("bounds the excerpt and flags truncation", () => {
		const observation = normalizeToolResponse("dump", { text: "x".repeat(5000) });
		expect(observation.excerpt.length).toBe(900);
		expect(observation.truncated).toBe(true);
		expect(observation.bytes).toBeGreaterThan(5000);
	});

	it("summarises the probe arguments for replay", () => {
		expect(describeProbe({ path: "/Applications/Notes.app", symbol: "exportPDF", other: true })).toBe(
			"path=/Applications/Notes.app symbol=exportPDF",
		);
		expect(describeProbe(null)).toBe("");
	});
});
