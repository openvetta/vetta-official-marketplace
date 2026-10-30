import { describe, expect, it } from "vitest";
import { appendEvidence, addUnknown, createCase } from "../domain/case-model";
import { renderCaseReport, renderCaseSpec, reportFileName, specFileName, type ReportLabels } from "../domain/report-renderer";

const labels: ReportLabels = {
	title: (name) => `REA report — ${name}`,
	specTitle: (name) => `REA spec — ${name}`,
	target: "Target",
	goal: "Goal",
	route: "Route",
	status: "Status",
	statusOpen: "open",
	statusClosed: "closed",
	generatedAt: "Generated",
	conclusions: "Confirmed",
	inferences: "Inferred",
	openQuestions: "Open questions",
	appendix: "Evidence appendix",
	empty: "_Nothing yet_",
	confirmed: "confirmed",
	inferred: "inferred",
	unknown: "unknown",
	source: "Source",
	probe: "Probe",
	fingerprint: "fingerprint",
	excerpt: "payload",
	specBehavior: "Behavior",
	specInputs: "Inputs",
	specOutputs: "Outputs",
	specEdgeCases: "Edge cases",
	specEvidence: "Supporting evidence",
	specNotice: "Written from observed behavior",
	specTodo: "TODO",
};

function sampleCase() {
	let reference = createCase({
		target: { path: "/Applications/Notes.app", kind: "electron", label: "Notes App" },
		goal: "Understand Export to PDF",
		route: "electron",
		now: 1_700_000_000_000,
	});
	reference = appendEvidence(reference, {
		origin: "tool",
		grade: "confirmed",
		claim: "binary_session → ready",
		tool: "binary_session",
		anchors: [{ file: "app.asar:/src/export.ts", line: 1188, symbol: "exportPDF" }],
		fingerprint: "abcdef0123456789",
		bytes: 2048,
		excerpt: '{"status":"ready"}',
		now: 1_700_000_000_100,
	});
	reference = appendEvidence(reference, {
		origin: "agent",
		grade: "inferred",
		claim: "Export goes through PDFKit",
		now: 1_700_000_000_200,
	});
	reference = addUnknown(reference, "Which template renders the cover page?");
	return reference;
}

describe("report rendering", () => {
	it("separates conclusions, inferences and open questions", () => {
		const markdown = renderCaseReport(sampleCase(), labels, 1_700_000_100_000);
		expect(markdown).toContain("REA report — Notes App");
		expect(markdown).toContain("## Confirmed (1)");
		expect(markdown).toContain("## Inferred (1)");
		expect(markdown).toContain("## Open questions (1)");
		expect(markdown).toContain("Which template renders the cover page?");
		expect(markdown).toContain("app.asar:/src/export.ts:1188");
		expect(markdown).toContain("fingerprint `abcdef0123456789`");
	});

	it("embeds the payload as a collapsible appendix block", () => {
		const markdown = renderCaseReport(sampleCase(), labels);
		expect(markdown).toContain("<details>");
		expect(markdown).toContain('"status":"ready"');
	});

	it("renders a spec whose behaviour section carries only confirmed evidence", () => {
		const markdown = renderCaseSpec(sampleCase(), labels);
		expect(markdown).toContain("## Behavior");
		expect(markdown).toContain("binary_session → ready");
		expect(markdown).toContain("## Supporting evidence");
		expect(markdown).toContain("Export goes through PDFKit");
	});

	it("produces readable, stable file names", () => {
		const reference = sampleCase();
		expect(reportFileName(reference)).toBe("rea-notes-app-report.md");
		expect(specFileName(reference)).toBe("rea-notes-app-spec.md");
	});
});
