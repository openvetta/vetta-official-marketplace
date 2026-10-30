import { describe, expect, it } from "vitest";
import {
	addUnknown,
	appendEvidence,
	createCase,
	gradeCounts,
	MAX_TOOL_EVIDENCE,
	parseStoredCase,
	resolveUnknown,
	setCaseStatus,
	summarizeCase,
} from "../domain/case-model";

const baseCase = () =>
	createCase({
		target: { path: "/Applications/Notes.app", kind: "electron", label: "Notes" },
		goal: "Understand how Export to PDF works",
		route: "electron",
		now: 1_700_000_000_000,
	});

describe("case model", () => {
	it("opens a case with the goal and route it was given", () => {
		const reference = baseCase();
		expect(reference.status).toBe("open");
		expect(reference.route).toBe("electron");
		expect(reference.title).toBe("Notes");
		expect(reference.evidence).toEqual([]);
		expect(reference.unknowns).toEqual([]);
	});

	it("merges an identical observation instead of duplicating it", () => {
		let reference = baseCase();
		const input = {
			origin: "tool" as const,
			grade: "confirmed" as const,
			claim: "binary_session → status ready",
			tool: "binary_session",
			fingerprint: "abc",
			now: 1,
		};
		reference = appendEvidence(reference, input);
		reference = appendEvidence(reference, { ...input, now: 2 });
		expect(reference.evidence).toHaveLength(1);
		expect(reference.evidence[0]!.at).toBe(2);
	});

	it("keeps manual findings when tool noise is trimmed", () => {
		let reference = baseCase();
		reference = appendEvidence(reference, {
			origin: "agent",
			grade: "confirmed",
			claim: "Export uses PDFKit",
			now: 1,
		});
		for (let index = 0; index < MAX_TOOL_EVIDENCE + 25; index += 1) {
			reference = appendEvidence(reference, {
				origin: "tool",
				grade: "confirmed",
				claim: `probe ${index}`,
				tool: "binary_session",
				fingerprint: `fp-${index}`,
				now: 10 + index,
			});
		}
		const toolEntries = reference.evidence.filter((entry) => entry.origin === "tool");
		expect(toolEntries).toHaveLength(MAX_TOOL_EVIDENCE);
		expect(reference.evidence.some((entry) => entry.claim === "Export uses PDFKit")).toBe(true);
		// The newest tool entries survive; the oldest are the ones dropped.
		expect(toolEntries.some((entry) => entry.claim === "probe 0")).toBe(false);
		expect(toolEntries.some((entry) => entry.claim === `probe ${MAX_TOOL_EVIDENCE + 24}`)).toBe(true);
	});

	it("tracks open questions without duplicating them", () => {
		let reference = baseCase();
		reference = addUnknown(reference, "Where does the PDF template come from?");
		reference = addUnknown(reference, "Where does the PDF template come from?");
		expect(reference.unknowns).toHaveLength(1);
		reference = resolveUnknown(reference, "Where does the PDF template come from?");
		expect(reference.unknowns).toEqual([]);
	});

	it("reports grades and status changes in the summary", () => {
		let reference = baseCase();
		reference = appendEvidence(reference, { origin: "tool", grade: "confirmed", claim: "a" });
		reference = appendEvidence(reference, { origin: "agent", grade: "inferred", claim: "b" });
		reference = appendEvidence(reference, { origin: "agent", grade: "unknown", claim: "c" });
		reference = setCaseStatus(reference, "closed");
		const summary = summarizeCase(reference);
		expect(summary).toMatchObject({ confirmed: 1, inferred: 1, unknown: 1, status: "closed", evidenceCount: 3 });
		expect(gradeCounts(reference)).toEqual({ confirmed: 1, inferred: 1, unknown: 1 });
	});

	it("refuses stored data that is not a case", () => {
		expect(parseStoredCase(null)).toBeNull();
		expect(parseStoredCase({ schemaVersion: 2, id: "x", target: {}, goal: "g", evidence: [] })).toBeNull();
		expect(parseStoredCase({ schemaVersion: 1, id: "x", target: {}, goal: "g" })).toBeNull();
	});

	it("repairs a stored case with unknown fields", () => {
		const stored = parseStoredCase({
			schemaVersion: 1,
			id: "c1",
			target: { label: "Notes" },
			goal: "g",
			route: "nonsense",
			evidence: [{ claim: "kept", grade: "confirmed", origin: "weird", at: 5 }],
		});
		expect(stored?.route).toBe("unknown");
		expect(stored?.evidence[0]).toMatchObject({ claim: "kept", origin: "agent" });
	});
});
