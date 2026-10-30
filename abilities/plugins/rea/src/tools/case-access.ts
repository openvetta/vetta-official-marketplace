import type { ReaCase } from "../domain/case-model";
import { getActiveCaseId, listCaseSummaries, loadCase } from "../services/case-store";

export interface ActiveCaseResult {
	case: ReaCase | null;
	reason?: "none" | "missing";
}

/**
 * The active case follows the workspace: each project resumes the investigation
 * it was on. With no session cwd (or no case recorded for it) a single existing
 * case is used rather than forcing the user to restate the target.
 */
export async function resolveActiveCase(cwd: string | null): Promise<ActiveCaseResult> {
	const activeId = await getActiveCaseId(cwd);
	if (activeId) {
		const found = await loadCase(activeId);
		if (found) return { case: found };
	}
	const summaries = await listCaseSummaries();
	if (!cwd && summaries.length === 1) {
		const found = await loadCase(summaries[0]!.id);
		if (found) return { case: found };
	}
	return { case: null, reason: summaries.length === 0 ? "none" : "missing" };
}

export function compactCase(reference: ReaCase) {
	return {
		caseId: reference.id,
		title: reference.title,
		target: reference.target,
		goal: reference.goal,
		route: reference.route,
		status: reference.status,
		updatedAt: reference.updatedAt,
		evidence: {
			total: reference.evidence.length,
			confirmed: reference.evidence.filter((entry) => entry.grade === "confirmed").length,
			inferred: reference.evidence.filter((entry) => entry.grade === "inferred").length,
			unknown: reference.evidence.filter((entry) => entry.grade === "unknown").length,
		},
		unknowns: reference.unknowns,
	};
}
