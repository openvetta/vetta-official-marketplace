/**
 * Report and SPEC rendering.
 *
 * The deliverable of an investigation is a document that survives the chat:
 * conclusions with their grade, the open questions, and an evidence appendix a
 * reviewer can re-run. Labels are injected so the file follows the UI language
 * without the renderer knowing anything about i18n.
 */

import { gradeCounts, timeline, type EvidenceEntry, type ReaCase } from "./case-model";
import { routeDefinition } from "./route-catalog";

export interface ReportLabels {
	title: (caseTitle: string) => string;
	target: string;
	goal: string;
	route: string;
	status: string;
	statusOpen: string;
	statusClosed: string;
	generatedAt: string;
	conclusions: string;
	inferences: string;
	openQuestions: string;
	appendix: string;
	empty: string;
	confirmed: string;
	inferred: string;
	unknown: string;
	source: string;
	probe: string;
	fingerprint: string;
	excerpt: string;
	specTitle: (caseTitle: string) => string;
	specBehavior: string;
	specInputs: string;
	specOutputs: string;
	specEdgeCases: string;
	specEvidence: string;
	specNotice: string;
	specTodo: string;
}

function formatTime(timestamp: number): string {
	const date = new Date(timestamp);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function anchorLine(entry: EvidenceEntry): string {
	return entry.anchors
		.map((anchor) => {
			const location = anchor.file ? `${anchor.file}${anchor.line ? `:${anchor.line}` : ""}` : "";
			const parts = [location, anchor.symbol, anchor.key && anchor.value ? `${anchor.key}=${anchor.value}` : ""].filter(
				Boolean,
			);
			return parts.join(" · ");
		})
		.filter(Boolean)
		.join("; ");
}

function entryLine(entry: EvidenceEntry, labels: ReportLabels): string {
	const bits = [`- ${entry.claim}`];
	const pointer = anchorLine(entry);
	if (pointer) bits.push(`  - ${pointer}`);
	const meta = [
		entry.tool ? `\`${entry.tool}\`` : "",
		entry.origin,
		formatTime(entry.at),
		entry.fingerprint ? `${labels.fingerprint} \`${entry.fingerprint}\`` : "",
	].filter(Boolean);
	if (meta.length > 0) bits.push(`  - ${meta.join(" · ")}`);
	return bits.join("\n");
}

export function renderCaseReport(reference: ReaCase, labels: ReportLabels, now = Date.now()): string {
	const ordered = timeline(reference);
	const byGrade = (grade: EvidenceEntry["grade"]) => ordered.filter((entry) => entry.grade === grade);
	const counts = gradeCounts(reference);
	const route = routeDefinition(reference.route);
	const lines: string[] = [];

	lines.push(`# ${labels.title(reference.title)}`, "");
	lines.push(`- ${labels.target}: \`${reference.target.path ?? reference.target.label}\` (${reference.target.kind})`);
	lines.push(`- ${labels.goal}: ${reference.goal}`);
	lines.push(`- ${labels.route}: ${reference.route} — ${route.id}`);
	lines.push(`- ${labels.status}: ${reference.status === "open" ? labels.statusOpen : labels.statusClosed}`);
	lines.push(`- ${labels.generatedAt}: ${formatTime(now)}`, "");

	lines.push(`## ${labels.conclusions} (${counts.confirmed})`, "");
	const confirmed = byGrade("confirmed");
	lines.push(confirmed.length > 0 ? confirmed.map((entry) => entryLine(entry, labels)).join("\n") : labels.empty, "");

	lines.push(`## ${labels.inferences} (${counts.inferred})`, "");
	const inferred = byGrade("inferred");
	lines.push(inferred.length > 0 ? inferred.map((entry) => entryLine(entry, labels)).join("\n") : labels.empty, "");

	lines.push(`## ${labels.openQuestions} (${reference.unknowns.length})`, "");
	lines.push(
		reference.unknowns.length > 0 ? reference.unknowns.map((item) => `- ${item}`).join("\n") : labels.empty,
		"",
	);

	lines.push(`## ${labels.appendix} (${ordered.length})`, "");
	if (ordered.length === 0) {
		lines.push(labels.empty);
	} else {
		for (const entry of ordered) {
			const head = `### ${entry.grade.toUpperCase()} · ${entry.tool ?? entry.origin} · ${formatTime(entry.at)}`;
			lines.push(head, "", entryLine(entry, labels).replace(/^- /u, ""), "");
			if (entry.excerpt) {
				lines.push("<details>", `<summary>${labels.excerpt}</summary>`, "", "```", entry.excerpt, "```", "", "</details>", "");
			}
		}
	}

	return `${lines.join("\n").replace(/\n{3,}/gu, "\n\n").trimEnd()}\n`;
}

export function renderCaseSpec(reference: ReaCase, labels: ReportLabels, now = Date.now()): string {
	const ordered = timeline(reference);
	const confirmed = ordered.filter((entry) => entry.grade === "confirmed");
	const inferred = ordered.filter((entry) => entry.grade === "inferred");
	const evidenceList = (entries: EvidenceEntry[]) =>
		entries.length > 0
			? entries.map((entry) => `- ${entry.claim}${anchorLine(entry) ? ` (${anchorLine(entry)})` : ""}`).join("\n")
			: labels.empty;

	const lines = [
		`# ${labels.specTitle(reference.title)}`,
		"",
		`> ${labels.specNotice}`,
		"",
		`- ${labels.target}: \`${reference.target.path ?? reference.target.label}\``,
		`- ${labels.goal}: ${reference.goal}`,
		`- ${labels.generatedAt}: ${formatTime(now)}`,
		"",
		`## ${labels.specBehavior}`,
		"",
		evidenceList(confirmed),
		"",
		`## ${labels.specInputs}`,
		"",
		`- ${labels.specTodo}`,
		"",
		`## ${labels.specOutputs}`,
		"",
		`- ${labels.specTodo}`,
		"",
		`## ${labels.specEdgeCases}`,
		"",
		reference.unknowns.length > 0
			? reference.unknowns.map((item) => `- ${labels.specTodo} ${item}`).join("\n")
			: `- ${labels.specTodo}`,
		"",
		`## ${labels.specEvidence}`,
		"",
		evidenceList(inferred),
		"",
	];
	return `${lines.join("\n").replace(/\n{3,}/gu, "\n\n").trimEnd()}\n`;
}

export function reportFileName(reference: ReaCase): string {
	const slug = reference.target.label
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, "-")
		.replace(/^-+|-+$/gu, "")
		.slice(0, 40);
	return `rea-${slug || reference.id}-report.md`;
}

export function specFileName(reference: ReaCase): string {
	return reportFileName(reference).replace(/-report\.md$/u, "-spec.md");
}
