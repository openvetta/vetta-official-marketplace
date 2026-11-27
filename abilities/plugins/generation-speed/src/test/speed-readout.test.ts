import { describe, expect, it } from "vitest";
import { toSpeedReadout } from "../domain/speed-readout";
import { makeCall, makeSnapshot } from "./metrics-fixtures";
import { formatDuration, formatSpeed, formatTokens } from "../shared/formatters/metric-format";

describe("toSpeedReadout", () => {
	it("hides the readout when the host cannot provide metrics", () => {
		expect(toSpeedReadout(makeSnapshot({ supported: false }))).toBeNull();
	});

	it("uses the recent 2-second speed while text is streaming", () => {
		const snapshot = makeSnapshot({
			phase: "text",
			call: makeCall({ status: "streaming", recentTokensPerSecond: 123, tokensPerSecond: 90, estimated: true }),
		});
		expect(toSpeedReadout(snapshot)).toEqual({ state: "live", tokensPerSecond: 123, approximate: true });
	});

	it("treats thinking and tool arguments as live generation", () => {
		for (const phase of ["thinking", "tool-args"] as const) {
			const snapshot = makeSnapshot({ phase, call: makeCall({ status: "streaming", recentTokensPerSecond: 60 }) });
			expect(toSpeedReadout(snapshot)?.state).toBe("live");
		}
	});

	it("settles on the call average with the real token count after the call ends", () => {
		expect(toSpeedReadout(makeSnapshot())).toEqual({ state: "settled", tokensPerSecond: 120, approximate: false });
	});

	it("keeps the last call average while tools run between calls", () => {
		const readout = toSpeedReadout(makeSnapshot({ phase: "between-calls" }));
		expect(readout).toEqual({ state: "between-calls", tokensPerSecond: 120, approximate: false });
	});

	it("reports waiting before the first token and empty before any generation", () => {
		expect(toSpeedReadout(makeSnapshot({ phase: "waiting" }))?.state).toBe("waiting");
		expect(toSpeedReadout(makeSnapshot({ call: null }))?.state).toBe("empty");
	});
});

describe("formatters", () => {
	it("formats speed with an estimate marker", () => {
		expect(formatSpeed(123.4, true)).toBe("≈123 tok/s");
		expect(formatSpeed(42.25, false)).toBe("42.3 tok/s");
		expect(formatSpeed(null, true)).toBe("—");
	});

	it("formats durations and token counts", () => {
		expect(formatDuration(420)).toBe("420 ms");
		expect(formatDuration(3210)).toBe("3.2 s");
		expect(formatDuration(null)).toBe("—");
		expect(formatTokens(1500)).toBe("1,500");
		expect(formatTokens(12_345, true)).toBe("≈12.3k");
	});
});
