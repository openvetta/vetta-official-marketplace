import type { PluginAgentHandlerContext, PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import { gradeCounts, timeline } from "../domain/case-model";
import { resolveActiveCase } from "./case-access";

interface CaseStatusInput {
	includeEvidence?: boolean;
	limit?: number;
}

export const caseStatusTool: PluginAgentToolRegistration<CaseStatusInput> = {
	id: "case-status",
	name: "case_status",
	label: "%tool.caseStatus.label%",
	description:
		"Read the current REA case: target, route, evidence counts, open questions, and optionally the most recent evidence entries. Use it when resuming an investigation or before writing a report, so the summary reflects everything already recorded instead of only this turn. Do not use it as a substitute for running REA tools — it reports what was found, it does not find anything.",
	parameters: {
		type: "object",
		properties: {
			includeEvidence: { type: "boolean", description: "Include recent evidence entries (default false)." },
			limit: { type: "number", description: "How many recent entries to include, 1–50 (default 12)." },
		},
	},
	scope_use: ["conversation", "project"],
	handler: async ({ trigger, session }: PluginAgentHandlerContext<{ kind: "tool-call"; input: CaseStatusInput }>) => {
		const active = await resolveActiveCase(session.cwd);
		if (!active.case) {
			return {
				found: false,
				reason:
					active.reason === "none"
						? "No REA case exists yet. Call case_open with the target and goal to start one."
						: "No case is associated with this workspace. Call case_open for this target.",
			};
		}
		const reference = active.case;
		const limit = Math.min(50, Math.max(1, Math.round(Number(trigger.input?.limit ?? 12))));
		const recent = trigger.input?.includeEvidence === false ? [] : timeline(reference).slice(-limit);
		return {
			found: true,
			caseId: reference.id,
			title: reference.title,
			target: reference.target,
			goal: reference.goal,
			route: reference.route,
			status: reference.status,
			counts: gradeCounts(reference),
			unknowns: reference.unknowns,
			recent: recent.map((entry) => ({
				grade: entry.grade,
				origin: entry.origin,
				tool: entry.tool,
				claim: entry.claim,
				at: entry.at,
				anchors: entry.anchors,
				fingerprint: entry.fingerprint,
			})),
			next:
				reference.unknowns.length > 0
					? `Close the biggest unknown first: ${reference.unknowns[0]}`
					: "No open questions recorded. Either report the findings or add the next unknown worth resolving.",
		};
	},
};
