import { describe, expect, it } from "vitest";
import { buildServeArgs, parseServePort, SERVE_SIM_PACKAGE } from "../src/runtime/serve-sim-command.js";

describe("buildServeArgs", () => {
	it("pins an exact serve-sim version instead of @latest", () => {
		expect(SERVE_SIM_PACKAGE).toMatch(/^serve-sim@\d+\.\d+\.\d+$/);
		expect(buildServeArgs()).toContain(SERVE_SIM_PACKAGE);
	});

	it("never waits for npx's install prompt, which would hang without a TTY", () => {
		expect(buildServeArgs()[0]).toBe("--yes");
	});

	it("serves on the host-allocated port", () => {
		const args = buildServeArgs();
		expect(args[args.indexOf("-p") + 1]).toBe("{{PORT}}");
	});

	it("opens the narrow-panel layout: no side panes, device fitted to the viewport", () => {
		const args = buildServeArgs();
		expect(args[args.indexOf("--panes") + 1]).toBe("none");
		expect(args).toContain("--fit");
	});
});

describe("parseServePort", () => {
	it("reads the port serve-sim actually listens on", () => {
		const output = "Starting simulator stream...\n\n  - Local:   http://localhost:3290\n  - Network: use --host 0.0.0.0\n";
		expect(parseServePort(output)).toBe(3290);
	});

	it("accepts the IPv4 loopback form too", () => {
		expect(parseServePort("Local: http://127.0.0.1:4100")).toBe(4100);
	});

	it("returns null until the server has printed its address", () => {
		expect(parseServePort("Starting simulator stream...")).toBeNull();
		expect(parseServePort("")).toBeNull();
	});
});
