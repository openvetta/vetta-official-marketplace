/**
 * Readiness probing.
 *
 * REA is only as capable as the engines next to it: a native route without
 * Hopper/Ghidra/IDA sits in "blocked" forever, and the user finds out after the
 * first failed tool call. The checks below are local, cached and deliberately
 * honest about what they could not determine.
 *
 * Two facts are kept apart on purpose:
 * - **missing** — the binary/app is not on disk.
 * - **unchecked** — it is on disk, but the host did not let the plugin execute it
 *   (every command must be enabled per plugin), so the version is unknown.
 *
 * Presence comes from the filesystem, never from a command that may be refused,
 * so a fresh install cannot report installed software as missing.
 */

import { getPluginContext, waitForPluginContext } from "../plugin-context";
import type { EngineId } from "../domain/route-catalog";

export type ProbeStatus = "ready" | "missing" | "blocked" | "outdated" | "unchecked" | "unsupported";

export interface ProbeResult {
	id: EngineId;
	status: ProbeStatus;
	/** Short human-readable identity, e.g. `v22.22.2 · /opt/homebrew/bin/node`. */
	detail?: string;
	/** True when found on disk but not verifiable by running it. */
	unverified?: boolean;
}

export interface ReadinessReport {
	platform: "macos" | "windows" | "linux";
	checkedAt: number;
	probes: ProbeResult[];
}

export function detectPlatform(userAgent = navigator.userAgent): ReadinessReport["platform"] {
	if (/win/iu.test(userAgent)) return "windows";
	if (/mac/iu.test(userAgent)) return "macos";
	return "linux";
}

/** REA documents Node 22.23.4+, 24.22.1+ or 26.12.1+; older builds warn but still start. */
export function isSupportedNode(version: string): boolean {
	const match = /v?(\d+)\.(\d+)\.(\d+)/u.exec(version.trim());
	if (!match) return false;
	const major = Number(match[1]);
	const minor = Number(match[2]);
	const patch = Number(match[3]);
	const atLeast = (wantedMajor: number, wantedMinor: number, wantedPatch: number) =>
		major > wantedMajor ||
		(major === wantedMajor && (minor > wantedMinor || (minor === wantedMinor && patch >= wantedPatch)));
	if (major === 22) return atLeast(22, 23, 4);
	if (major === 24) return atLeast(24, 22, 1);
	return atLeast(26, 12, 1);
}

const APP_CANDIDATES: Record<ReadinessReport["platform"], string[]> = {
	macos: ["/Applications", "/Users/Public/Desktop"],
	windows: ["C:/Program Files", "C:/Program Files (x86)"],
	linux: ["/opt", "/usr/share", "/usr/local"],
};

const CLI_CANDIDATES: Record<ReadinessReport["platform"], string[]> = {
	macos: ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"],
	windows: ["C:/Program Files/nodejs", "C:/Program Files/Java", "C:/Program Files/Eclipse Adoptium"],
	linux: ["/usr/local/bin", "/usr/bin", "/bin", "/opt"],
};

/** Names as they appear in an app bundle or install directory, lower-case. */
const APP_NAMES: Partial<Record<EngineId, string[]>> = {
	hopper: ["hopper disassembler", "hopper"],
	ghidra: ["ghidra"],
	ida: ["ida pro", "ida free", "ida"],
	kuna: ["kuna"],
	chrome: ["google chrome", "chromium", "microsoft edge", "chrome"],
};

const CLI_NAMES: Partial<Record<EngineId, string[]>> = {
	node: ["node"],
	npm: ["npm"],
	rea: ["rea"],
	ghidra: ["ghidraRun"],
	jadx: ["jadx", "jadx-gui"],
	jdk: ["java"],
};

async function listDirectory(path: string): Promise<string[]> {
	try {
		const entries = await getPluginContext().fs.readDir(path);
		return entries.map((entry) => entry.name);
	} catch {
		return [];
	}
}

async function exists(path: string): Promise<boolean> {
	try {
		return (await getPluginContext().fs.stat(path)) !== null;
	} catch {
		return false;
	}
}

async function findApp(names: string[], platform: ReadinessReport["platform"]): Promise<string | undefined> {
	for (const root of APP_CANDIDATES[platform]) {
		const entries = await listDirectory(root);
		const match = entries.find((entry) => {
			const lower = entry.toLowerCase();
			return names.some((name) => lower.includes(name));
		});
		if (match) return `${root}/${match}`;
	}
	return undefined;
}

async function findBinary(names: string[], platform: ReadinessReport["platform"]): Promise<string | undefined> {
	for (const root of CLI_CANDIDATES[platform]) {
		for (const name of names) {
			const candidate = `${root}/${name}`;
			if (await exists(candidate)) return candidate;
		}
	}
	return undefined;
}

/**
 * Running a binary needs both the manifest declaration and the user's per-command
 * toggle; any refusal lands here and must not be read as "not installed".
 */
async function runVersion(file: string, args: string[]): Promise<string | undefined> {
	try {
		const result = await getPluginContext().command.run(file, args, { timeoutMs: 8000 });
		const text = `${result.stdout} ${result.stderr}`.trim();
		return text.split("\n")[0]?.trim() || undefined;
	} catch {
		return undefined;
	}
}

async function probeEngine(id: EngineId, platform: ReadinessReport["platform"]): Promise<ProbeResult> {
	const appNames = APP_NAMES[id];
	if (appNames) {
		const app = await findApp(appNames, platform);
		if (app) return { id, status: "ready", detail: app };
	}

	const names = CLI_NAMES[id];
	const binary = names ? await findBinary(names, platform) : undefined;

	if (id === "node") {
		if (!binary) return { id, status: "missing" };
		const version = await runVersion(binary, ["--version"]);
		if (!version) return { id, status: "unchecked", detail: binary, unverified: true };
		return {
			id,
			// Below the documented floor REA warns but still runs; saying "blocked"
			// would send the user to reinstall a runtime that works.
			status: isSupportedNode(version) ? "ready" : "outdated",
			detail: `${version} · ${binary}`,
		};
	}

	if (id === "npm" || id === "rea") {
		if (!binary) return { id, status: "missing" };
		const version = await runVersion(binary, ["--version"]);
		return {
			id,
			status: version ? "ready" : "unchecked",
			detail: version ? `${version} · ${binary}` : binary,
			unverified: !version,
		};
	}

	if (id === "jdk") {
		if (!binary) return { id, status: "missing" };
		const version = await runVersion(binary, ["-version"]);
		return { id, status: "ready", detail: version ?? binary };
	}

	if (binary) return { id, status: "ready", detail: binary };
	// Chrome ships as an app bundle on every supported platform.
	if (appNames) return { id, status: "missing" };
	return { id, status: "missing" };
}

let cache: ReadinessReport | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

const PROBED: EngineId[] = ["node", "npm", "chrome", "hopper", "ghidra", "ida", "kuna", "jadx", "jdk", "rea"];

export async function probeReadiness(force = false): Promise<ReadinessReport> {
	if (!force && cache && Date.now() - cacheAt < CACHE_MS) return cache;
	// Probes run against the plugin's own context; a surface mounted mid-activation
	// would otherwise report every installed engine as absent.
	const ready = await waitForPluginContext();
	if (!ready) throw new Error("REA plugin is not active");
	const platform = detectPlatform();
	const probes: ProbeResult[] = [];
	for (const engine of PROBED) {
		try {
			probes.push(await probeEngine(engine, platform));
		} catch (error) {
			// One unreadable root must not blank the whole panel.
			probes.push({ id: engine, status: "unchecked", unverified: true });
			console.warn(`[rea] readiness probe failed for ${engine}`, error);
		}
	}
	const report: ReadinessReport = { platform, checkedAt: Date.now(), probes };
	cache = report;
	cacheAt = Date.now();
	return report;
}

export interface RouteReadiness {
	route: string;
	ready: boolean;
	engines: Array<{ id: EngineId; status: ProbeStatus }>;
}

/** Narrow the full report to the engines one route needs. */
export function readinessForEngines(
	report: ReadinessReport,
	engines: readonly EngineId[],
): Array<{ id: EngineId; status: ProbeStatus }> {
	return engines.map((id) => {
		const probe = report.probes.find((item) => item.id === id);
		return { id, status: probe?.status ?? "missing" };
	});
}

/** A route is only blocked by engines that are genuinely absent. */
export function isEngineUsable(status: ProbeStatus): boolean {
	return status === "ready" || status === "unchecked" || status === "outdated";
}

export function resetReadinessCache(): void {
	cache = null;
	cacheAt = 0;
}
