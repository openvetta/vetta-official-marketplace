/**
 * Routes are REA's core idea: the target decides the tools, and each route has
 * prerequisites that can be missing. `case_open` uses this catalogue to tell
 * the agent, before a single probe, what "ready" and "blocked" look like.
 */

import type { ReaRouteId } from "./case-model";

export type EngineId =
	| "node"
	| "npm"
	| "rea"
	| "chrome"
	| "hopper"
	| "ghidra"
	| "ida"
	| "kuna"
	| "jadx"
	| "jdk";

export interface RouteDefinition {
	id: ReaRouteId;
	/** i18n key for the short route name shown on chips. */
	labelKey: string;
	/** i18n key for one sentence about what this route can prove. */
	summaryKey: string;
	/** Prerequisites that must be present for the route to produce evidence. */
	engines: EngineId[];
	/** First probe to run, written for the model rather than the UI. */
	firstProbe: string;
}

export const ROUTES: readonly RouteDefinition[] = [
	{
		id: "electron",
		labelKey: "route.electron.label",
		summaryKey: "route.electron.summary",
		engines: ["node"],
		firstProbe: "Locate the app bundle, read package.json and app.asar, then map the main-process IPC handlers behind the feature.",
	},
	{
		id: "javascript",
		labelKey: "route.javascript.label",
		summaryKey: "route.javascript.summary",
		engines: ["node"],
		firstProbe: "Inventory modules and entry points, then trace the module that owns the feature.",
	},
	{
		id: "website",
		labelKey: "route.website.label",
		summaryKey: "route.website.summary",
		engines: ["chrome"],
		firstProbe: "Open the site in the browser tool, capture the requests the feature makes, then read the bundle that issues them.",
	},
	{
		id: "native",
		labelKey: "route.native.label",
		summaryKey: "route.native.summary",
		engines: ["hopper", "ghidra", "ida", "kuna"],
		firstProbe: "Open the binary in the configured engine, find the function behind the feature, then follow its callers and cross-references.",
	},
	{
		id: "dotnet",
		labelKey: "route.dotnet.label",
		summaryKey: "route.dotnet.summary",
		engines: [],
		firstProbe: "Load the assembly metadata, find the type and method behind the feature, then read its IL and declared native dependencies.",
	},
	{
		id: "android",
		labelKey: "route.android.label",
		summaryKey: "route.android.summary",
		engines: ["jadx", "jdk"],
		firstProbe: "Decode the manifest and dex, find the activity or service behind the feature, then read the method body.",
	},
	{
		id: "evm",
		labelKey: "route.evm.label",
		summaryKey: "route.evm.summary",
		engines: [],
		firstProbe: "Decode the dispatcher, map the selectors, then read the function that owns the behavior.",
	},
	{
		id: "artifact",
		labelKey: "route.artifact.label",
		summaryKey: "route.artifact.summary",
		engines: [],
		firstProbe: "Inspect the artifact headers and inventory, then identify the entries the feature depends on.",
	},
	{
		id: "unknown",
		labelKey: "route.unknown.label",
		summaryKey: "route.unknown.summary",
		engines: ["node"],
		firstProbe: "Identify the target format first — the route cannot be chosen until it is known.",
	},
];

export const ROUTE_BY_ID: Record<ReaRouteId, RouteDefinition> = Object.fromEntries(
	ROUTES.map((route) => [route.id, route]),
) as Record<ReaRouteId, RouteDefinition>;

export function routeDefinition(id: ReaRouteId): RouteDefinition {
	return ROUTE_BY_ID[id] ?? ROUTE_BY_ID.unknown;
}

/** Routes with no required engine are fully local: REA inspects the bytes itself. */
export function isSelfContainedRoute(id: ReaRouteId): boolean {
	return routeDefinition(id).engines.length === 0;
}

const EXTENSION_ROUTES: Record<string, ReaRouteId> = {
	asar: "electron",
	apk: "android",
	aab: "android",
	ipa: "android",
	exe: "native",
	dll: "dotnet",
	dylib: "native",
	so: "native",
	node: "native",
	ko: "native",
	elf: "native",
	bin: "native",
	app: "electron",
	jar: "native",
	class: "native",
	dotnet: "dotnet",
	pdb: "dotnet",
	wasm: "artifact",
	pck: "artifact",
	gguf: "artifact",
	safetensors: "artifact",
	ips: "artifact",
	har: "website",
	saz: "website",
	hex: "evm",
};

export interface RouteInference {
	route: ReaRouteId;
	/** 0…1, shown to the user instead of pretending the guess is a fact. */
	confidence: number;
	reason: string;
}

/** Guess the route from a path so the intake form can pre-select it. Never authoritative. */
export function inferRouteFromPath(path: string): RouteInference {
	const trimmed = path.trim().replace(/[/\\]+$/u, "");
	if (!trimmed) return { route: "unknown", confidence: 0, reason: "empty path" };
	const name = trimmed.split(/[/\\]/u).pop() ?? trimmed;
	const dot = name.lastIndexOf(".");
	const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
	if (extension && EXTENSION_ROUTES[extension]) {
		return {
			route: EXTENSION_ROUTES[extension]!,
			confidence: 0.6,
			reason: `.${extension} target`,
		};
	}
	if (trimmed.includes(".app/Contents/")) {
		return { route: "electron", confidence: 0.5, reason: "inside an application bundle" };
	}
	if (/^https?:\/\//iu.test(trimmed)) {
		return { route: "website", confidence: 0.9, reason: "URL target" };
	}
	if (!extension) {
		// A directory is most often an unpacked desktop application; natives are files.
		return { route: "electron", confidence: 0.3, reason: "directory target" };
	}
	return { route: "unknown", confidence: 0.1, reason: `unrecognised .${extension}` };
}
