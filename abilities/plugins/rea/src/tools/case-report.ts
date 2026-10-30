import type { PluginAgentHandlerContext, PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import { renderCaseReport, renderCaseSpec } from "../domain/report-renderer";
import type { ReportLabels } from "../domain/report-renderer";
import { getPluginContext } from "../plugin-context";
import { resolveActiveCase } from "./case-access";

interface CaseReportInput {
	format?: "report" | "spec";
}

/** With no page of its own, the agent writes the rendered Markdown into the project. */
function reportLabels(): ReportLabels {
	const t = getPluginContext().i18n.t;
	return {
		title: (caseTitle) => `${t("report.title")} — ${caseTitle}`,
		specTitle: (caseTitle) => `${t("report.specTitle")} — ${caseTitle}`,
		target: t("report.target"),
		goal: t("report.goal"),
		route: t("report.route"),
		status: t("report.status"),
		statusOpen: t("case.status.open"),
		statusClosed: t("case.status.closed"),
		generatedAt: t("report.generatedAt"),
		conclusions: t("grade.confirmed"),
		inferences: t("grade.inferred"),
		openQuestions: t("report.openQuestions"),
		appendix: t("report.appendix"),
		empty: t("report.empty"),
		confirmed: t("grade.confirmed"),
		inferred: t("grade.inferred"),
		unknown: t("grade.unknown"),
		source: t("report.source"),
		probe: t("report.probe"),
		fingerprint: t("report.fingerprint"),
		excerpt: t("report.excerpt"),
		specBehavior: t("report.specBehavior"),
		specInputs: t("report.specInputs"),
		specOutputs: t("report.specOutputs"),
		specEdgeCases: t("report.specEdgeCases"),
		specEvidence: t("report.specEvidence"),
		specNotice: t("report.specNotice"),
		specTodo: t("report.specTodo"),
	};
}

export const caseReportTool: PluginAgentToolRegistration<CaseReportInput> = {
	id: "case-report",
	name: "case_report",
	label: "%tool.caseReport.label%",
	description:
		"Render the current REA case as Markdown: a report with conclusions separated by evidence grade plus an evidence appendix, or a behaviour spec to implement. Use it when the user wants the investigation written down — write the returned Markdown into their workspace with your own file tools rather than pasting it into the chat. Do not use it before the case has evidence, and do not use it to answer a question that the case itself already answers.",
	parameters: {
		type: "object",
		properties: {
			format: {
				type: "string",
				enum: ["report", "spec"],
				description: "'report' (default) for the findings, 'spec' for an implementation scaffold.",
			},
		},
	},
	scope_use: ["conversation", "project"],
	handler: async ({ trigger, session }: PluginAgentHandlerContext<{ kind: "tool-call"; input: CaseReportInput }>) => {
		const active = await resolveActiveCase(session.cwd);
		if (!active.case) {
			return {
				rendered: false,
				reason:
					active.reason === "none"
						? "No REA case exists yet. Call case_open with the target and goal first."
						: "No case is associated with this workspace. Call case_open for this target.",
			};
		}
		const reference = active.case;
		const format = trigger.input?.format === "spec" ? "spec" : "report";
		const markdown =
			format === "spec"
				? renderCaseSpec(reference, reportLabels())
				: renderCaseReport(reference, reportLabels());
		return {
			rendered: true,
			caseId: reference.id,
			format,
			evidenceCount: reference.evidence.length,
			openQuestions: reference.unknowns,
			markdown,
			next: "Write this Markdown into the user's workspace (a .md file next to their project) and tell them where it is.",
		};
	},
};
