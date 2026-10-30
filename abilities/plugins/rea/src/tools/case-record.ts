import type { PluginAgentHandlerContext, PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import {
	addUnknown,
	appendEvidence,
	gradeCounts,
	isEvidenceGrade,
	resolveUnknown,
	trimText,
	type EvidenceAnchor,
	type EvidenceGrade,
} from "../domain/case-model";
import { updateCase } from "../services/case-store";
import { resolveActiveCase } from "./case-access";

interface CaseRecordInput {
	grade: EvidenceGrade;
	claim: string;
	anchors?: EvidenceAnchor[];
	/** An open question this evidence raises or leaves unanswered. */
	unknown?: string;
	/** An open question this evidence finally closes. */
	resolves?: string;
}

export const caseRecordTool: PluginAgentToolRegistration<CaseRecordInput> = {
	id: "case-record",
	name: "case_record",
	label: "%tool.caseRecord.label%",
	description:
		"Record one finding on the open REA case: what it proves, its evidence grade, and the file/line/symbol it rests on. Use 'confirmed' only for what a tool actually returned or what is directly observable, 'inferred' for a conclusion you drew from it, and 'unknown' for a gap that still blocks the answer. Call it after a batch of REA tool calls, and whenever a conclusion would otherwise live only in the chat. Do not use it to record speculation without naming what it rests on.",
	parameters: {
		type: "object",
		properties: {
			grade: { type: "string", enum: ["confirmed", "inferred", "unknown"] },
			claim: { type: "string", description: "One sentence a reviewer can check against the evidence." },
			anchors: {
				type: "array",
				description: "Pointers the claim rests on.",
				items: {
					type: "object",
					properties: {
						file: { type: "string" },
						line: { type: "number" },
						symbol: { type: "string" },
						key: { type: "string" },
						value: { type: "string" },
					},
				},
			},
			unknown: { type: "string", description: "Open question still unanswered." },
			resolves: { type: "string", description: "Exact text of an existing open question this finding answers." },
		},
		required: ["grade", "claim"],
	},
	scope_use: ["conversation", "project"],
	handler: async ({ trigger, session }: PluginAgentHandlerContext<{ kind: "tool-call"; input: CaseRecordInput }>) => {
		const input = trigger.input;
		const claim = String(input.claim ?? "").trim();
		if (!claim) throw new Error("claim is required");
		if (!isEvidenceGrade(input.grade)) throw new Error("grade must be confirmed, inferred or unknown");

		const active = await resolveActiveCase(session.cwd);
		if (!active.case) {
			return {
				recorded: false,
				reason: "No open case. Call case_open first, then record findings against it.",
			};
		}

		const updated = await updateCase(active.case.id, (reference) => {
			let next = appendEvidence(reference, {
				origin: "agent",
				grade: input.grade,
				claim: trimText(claim, 400),
				anchors: Array.isArray(input.anchors) ? input.anchors : [],
				fingerprint: `agent:${input.grade}`,
			});
			if (input.unknown) next = addUnknown(next, input.unknown);
			if (input.resolves) next = resolveUnknown(next, input.resolves);
			return next;
		});

		if (!updated) return { recorded: false, reason: "Case could not be loaded." };
		return {
			recorded: true,
			caseId: updated.id,
			counts: gradeCounts(updated),
			unknowns: updated.unknowns,
		};
	},
};
