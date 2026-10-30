import type { Disposable, PluginContext } from "@vetta-org/plugin-sdk";
import {
	describeProbe,
	isReaServer,
	normalizeToolFailure,
	normalizeToolResponse,
} from "../domain/evidence-normalizer";
import { appendEvidence } from "../domain/case-model";
import { updateCase } from "../services/case-store";
import { resolveActiveCase } from "../tools/case-access";

/**
 * Every REA tool call becomes an evidence entry.
 *
 * This is the part a chat transcript cannot do: the model does not have to
 * remember to write anything down, and the case fills itself while the
 * investigation runs. Failures are recorded too — an engine that refused a probe
 * is exactly the kind of gap a report has to show.
 */
export function registerEvidenceHooks(ctx: PluginContext): Disposable[] {
	const record = async (
		sessionCwd: string,
		sessionId: string,
		payload: ReturnType<typeof normalizeToolResponse>,
		probe?: string,
	): Promise<void> => {
		const active = await resolveActiveCase(sessionCwd);
		if (!active.case) return;
		await updateCase(active.case.id, (reference) =>
			appendEvidence(reference, {
				origin: "tool",
				grade: payload.grade,
				claim: payload.claim,
				tool: payload.tool,
				server: "rea",
				probe,
				anchors: payload.anchors,
				fingerprint: payload.fingerprint,
				bytes: payload.bytes,
				excerpt: payload.excerpt,
				sessionId,
			}),
		);
	};

	const disposables: Disposable[] = [];

	try {
		disposables.push(
			ctx.agent.registerHook({
				id: "rea-evidence",
				eventName: "PostToolUse",
				scope_use: ["conversation", "project"],
				timeoutMs: 5000,
				async handler({ event }) {
					if (event.tool.kind !== "mcp") return { action: "continue" };
					if (!isReaServer(event.tool.source?.serverName, event.tool.hostName)) return { action: "continue" };
					try {
						await record(
							event.cwd,
							event.sessionId,
							normalizeToolResponse(event.tool.hostName, event.toolResponse),
							describeProbe(event.toolInput),
						);
					} catch (error) {
						// Evidence capture must never break the agent turn.
						console.warn("[rea] failed to record tool evidence", error);
					}
					return { action: "continue" };
				},
			}),
		);

		disposables.push(
			ctx.agent.registerHook({
				id: "rea-evidence-failure",
				eventName: "PostToolUseFailure",
				scope_use: ["conversation", "project"],
				timeoutMs: 5000,
				async handler({ event }) {
					if (event.tool.kind !== "mcp") return { action: "continue" };
					if (!isReaServer(event.tool.source?.serverName, event.tool.hostName)) return { action: "continue" };
					try {
						await record(
							event.cwd,
							event.sessionId,
							normalizeToolFailure(event.tool.hostName, event.error),
							describeProbe(event.toolInput),
						);
					} catch (error) {
						console.warn("[rea] failed to record tool failure", error);
					}
					return { action: "continue" };
				},
			}),
		);
	} catch (error) {
		// Older hosts may not expose coding-agent hooks; the manual tools still work.
		console.warn("[rea] lifecycle hooks unavailable", error);
	}

	return disposables;
}
