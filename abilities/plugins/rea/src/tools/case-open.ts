import type { PluginAgentHandlerContext, PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import { createCase, type ReaRouteId } from "../domain/case-model";
import { inferRouteFromPath, isSelfContainedRoute, routeDefinition } from "../domain/route-catalog";
import { setActiveCaseId, saveCase } from "../services/case-store";
import { isEngineUsable, probeReadiness, readinessForEngines } from "../services/readiness-probe";

interface CaseOpenInput {
	target: string;
	goal: string;
	route?: ReaRouteId;
	kind?: string;
	title?: string;
	note?: string;
}

const ROUTE_ENUM: ReaRouteId[] = [
	"electron",
	"javascript",
	"website",
	"native",
	"dotnet",
	"android",
	"evm",
	"artifact",
	"unknown",
];

export const caseOpenTool: PluginAgentToolRegistration<CaseOpenInput> = {
	id: "case-open",
	name: "case_open",
	label: "%tool.caseOpen.label%",
	description:
		"Open the REA investigation case for the target the user wants to understand. Call this once at the start of an investigation, before using any REA tool, so evidence and open questions have a home. Returns the chosen route, the engine prerequisites that are missing for it, and what to probe first. Do not use it for ordinary questions about code the user already owns, and do not open a second case for the same target — the current one is reused.",
	parameters: {
		type: "object",
		properties: {
			target: {
				type: "string",
				description: "Absolute path to the app, binary, archive or directory, or an http(s) URL for a website target.",
			},
			goal: {
				type: "string",
				description: "What the user wants to understand or reproduce, in their own words, e.g. 'how does Export to PDF work'.",
			},
			route: {
				type: "string",
				enum: ROUTE_ENUM,
				description: "Investigation route. Omit to let the plugin infer it from the target path, then correct it if the evidence disagrees.",
			},
			kind: {
				type: "string",
				description: "Human-readable target kind, e.g. 'Electron app', 'Mach-O binary', 'Android APK'.",
			},
			title: { type: "string", description: "Short case title used in the report heading." },
			note: { type: "string", description: "Anything known up front that should stay attached to the case." },
		},
		required: ["target", "goal"],
	},
	scope_use: ["conversation", "project"],
	handler: async ({ trigger, session }: PluginAgentHandlerContext<{ kind: "tool-call"; input: CaseOpenInput }>) => {
		const input = trigger.input;
		const target = String(input.target ?? "").trim();
		const goal = String(input.goal ?? "").trim();
		if (!target) throw new Error("target is required");
		if (!goal) throw new Error("goal is required");

		const inferred = inferRouteFromPath(target);
		const route = input.route ?? inferred.route;
		const definition = routeDefinition(route);
		const readiness = await probeReadiness();
		const engines = readinessForEngines(readiness, definition.engines);
		const blocked = engines.filter((engine) => !isEngineUsable(engine.status));

		const reference = createCase({
			target: {
				path: target.startsWith("http") ? undefined : target,
				kind: input.kind?.trim() || definition.id,
				label: target,
				note: input.note,
			},
			title: input.title,
			goal,
			route,
		});
		const saved = await saveCase(reference);
		// The case belongs to the workspace it was opened from, so reopening that
		// project resumes this thread instead of the most recent one globally.
		await setActiveCaseId(session.cwd || null, saved.id);

		return {
			caseId: saved.id,
			route,
			routeInference: input.route ? "explicit" : `${inferred.route} (${inferred.reason}, confidence ${inferred.confidence})`,
			selfContained: isSelfContainedRoute(route),
			engines,
			missingEngines: blocked.map((engine) => engine.id),
			firstProbe: definition.firstProbe,
			next:
				blocked.length > 0
					? `Route ${route} needs ${blocked.map((engine) => engine.id).join(", ")} before it can produce evidence. Tell the user what is missing and continue with any route that is fully available.`
					: `Route ${route} is ready. Run the first REA probe for this target, then record what it proves with case_record.`,
			uncertain: input.route ? [] : [`Route guessed from the path (${inferred.reason}); confirm it against the target before deep analysis.`],
		};
	},
};
