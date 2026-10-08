import { describe, expect, it } from "vitest";
import {
	buildServeArgs,
	parseKeyboardIssue,
	parseServePort,
	SERVE_SIM_ENV,
	SERVE_SIM_PACKAGE,
} from "../src/runtime/serve-sim-command.js";

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

describe("SERVE_SIM_ENV", () => {
	it("turns off stdio buffering so keyboard diagnostics reach the host's pipe", () => {
		expect(SERVE_SIM_ENV).toEqual({ NSUnbufferedIO: "YES" });
	});
});

describe("parseKeyboardIssue", () => {
	const line = (reason: string): string =>
		`[hid] Device Hub keyboard unavailable for iPhone 17 Pro (EE592E58): ${reason}; using legacy HID\n`;

	it("returns null when the Device Hub route works", () => {
		expect(parseKeyboardIssue("  - Local:   http://localhost:3200\n")).toBeNull();
	});

	it("classifies a missing Accessibility permission", () => {
		const issue = parseKeyboardIssue(
			line("macOS Accessibility permission is not granted (System Settings > Privacy & Security > Accessibility)"),
		);
		expect(issue?.kind).toBe("accessibility");
		expect(issue?.device).toBe("iPhone 17 Pro");
	});

	it("classifies Device Hub not running", () => {
		expect(parseKeyboardIssue(line("Device Hub from the selected Xcode is not running"))?.kind).toBe("device-hub");
	});

	it("classifies every window routing failure together", () => {
		for (const reason of [
			"Device Hub has no visible simulator window",
			"the target simulator window is not visible",
			"the target simulator name matches 2 windows",
			"another Device Hub window has keyboard focus (iPad Pro)",
		]) {
			expect(parseKeyboardIssue(line(reason))?.kind).toBe("window");
		}
	});

	it("keeps unknown reasons verbatim", () => {
		expect(parseKeyboardIssue(line("CoreGraphics could not create a keyboard event"))).toEqual({
			kind: "other",
			device: "iPhone 17 Pro",
			reason: "CoreGraphics could not create a keyboard event",
		});
	});

	it("reports the latest reason when it changed", () => {
		const output = line("Device Hub from the selected Xcode is not running") + line("the target simulator window is not visible");
		expect(parseKeyboardIssue(output)?.kind).toBe("window");
	});
});
