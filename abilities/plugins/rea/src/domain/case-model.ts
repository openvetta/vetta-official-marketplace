/**
 * The case is the durable object of an investigation: what we are looking at,
 * which route we took, every piece of evidence we hold and what is still open.
 *
 * Everything here is pure data plus pure transitions, so the storage layer, the
 * the agent tools and the report renderer share one definition, so the rules
 * stay testable.
 */

export type EvidenceGrade = "confirmed" | "inferred" | "unknown";

/** Where an entry came from: a REA tool call, the agent's own reasoning, or the user. */
export type EvidenceOrigin = "tool" | "agent" | "user";

export type ReaRouteId =
	| "electron"
	| "javascript"
	| "website"
	| "native"
	| "dotnet"
	| "android"
	| "evm"
	| "artifact"
	| "unknown";

export type CaseStatus = "open" | "closed";

export interface EvidenceAnchor {
	/** Absolute or workspace-relative path the evidence points at. */
	file?: string;
	line?: number;
	/** Function, class, export or native symbol name. */
	symbol?: string;
	/** Structured pointer when no source location exists (address, selector, chunk id…). */
	key?: string;
	value?: string;
}

export interface EvidenceEntry {
	id: string;
	at: number;
	origin: EvidenceOrigin;
	grade: EvidenceGrade;
	/** Short canonical tool name, e.g. `binary_session`. */
	tool?: string;
	/** MCP server the tool belongs to, e.g. `rea`. */
	server?: string;
	/** One-line statement this evidence supports. */
	claim: string;
	/** Arguments that produced the payload, so the probe can be re-run. */
	probe?: string;
	anchors: EvidenceAnchor[];
	/** Stable fingerprint of the payload, for spotting repeated or drifted results. */
	fingerprint: string;
	bytes: number;
	excerpt?: string;
	truncated?: boolean;
	sessionId?: string;
}

export interface CaseTarget {
	path?: string;
	/** Free-form kind reported by the user or inferred from the path. */
	kind: string;
	label: string;
	note?: string;
}

export interface ReaCase {
	schemaVersion: 1;
	id: string;
	createdAt: number;
	updatedAt: number;
	title: string;
	target: CaseTarget;
	goal: string;
	route: ReaRouteId;
	status: CaseStatus;
	evidence: EvidenceEntry[];
	/** Open questions the investigation has not closed yet. */
	unknowns: string[];
}

export interface CaseSummary {
	id: string;
	title: string;
	target: CaseTarget;
	route: ReaRouteId;
	status: CaseStatus;
	updatedAt: number;
	evidenceCount: number;
	confirmed: number;
	inferred: number;
	unknown: number;
}

/** Tool-origin entries are the bulky ones; manual findings are never trimmed away. */
export const MAX_TOOL_EVIDENCE = 300;
export const MAX_MANUAL_EVIDENCE = 200;
export const MAX_EXCERPT_CHARS = 900;
export const MAX_CLAIM_CHARS = 400;

const ROUTE_IDS: readonly ReaRouteId[] = [
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

const GRADES: readonly EvidenceGrade[] = ["confirmed", "inferred", "unknown"];

export function isReaRoute(value: unknown): value is ReaRouteId {
	return typeof value === "string" && (ROUTE_IDS as readonly string[]).includes(value);
}

export function isEvidenceGrade(value: unknown): value is EvidenceGrade {
	return typeof value === "string" && (GRADES as readonly string[]).includes(value);
}

export function trimText(value: string, limit: number): string {
	const compact = value.replace(/\s+/gu, " ").trim();
	return compact.length <= limit ? compact : `${compact.slice(0, Math.max(0, limit - 1))}…`;
}

let counter = 0;

export function newCaseId(now: number): string {
	counter = (counter + 1) % 1000;
	return `rea-${now.toString(36)}-${counter.toString(36).padStart(2, "0")}`;
}

export function newEvidenceId(now: number): string {
	counter = (counter + 1) % 1000;
	return `ev-${now.toString(36)}-${counter.toString(36).padStart(2, "0")}`;
}

export interface CreateCaseInput {
	target: CaseTarget;
	goal: string;
	route?: ReaRouteId;
	title?: string;
	now?: number;
}

export function createCase(input: CreateCaseInput): ReaCase {
	const now = input.now ?? Date.now();
	const goal = trimText(input.goal, 600) || "Understand how the target works";
	const route = input.route ?? "unknown";
	return {
		schemaVersion: 1,
		id: newCaseId(now),
		createdAt: now,
		updatedAt: now,
		title:
			trimText(input.title ?? "", 120) ||
			trimText(input.target.label || input.target.path || "Untitled target", 120),
		target: {
			path: input.target.path?.trim() || undefined,
			kind: input.target.kind.trim() || "unknown",
			label: trimText(input.target.label || input.target.path || "Untitled target", 200),
			note: input.target.note?.trim() || undefined,
		},
		goal,
		route,
		status: "open",
		evidence: [],
		unknowns: [],
	};
}

export interface AppendEvidenceInput {
	origin: EvidenceOrigin;
	grade: EvidenceGrade;
	claim: string;
	tool?: string;
	server?: string;
	probe?: string;
	anchors?: EvidenceAnchor[];
	fingerprint?: string;
	bytes?: number;
	excerpt?: string;
	sessionId?: string;
	now?: number;
}

function evidenceKey(entry: Pick<EvidenceEntry, "origin" | "grade" | "claim" | "fingerprint">): string {
	return `${entry.origin}|${entry.grade}|${entry.claim}|${entry.fingerprint}`;
}

/**
 * Append one entry. Identical observations (same origin, claim and payload
 * fingerprint) are merged instead of duplicated — REA tools are repeatedly
 * called with the same arguments while a session narrows down a question.
 */
export function appendEvidence(reference: ReaCase, input: AppendEvidenceInput): ReaCase {
	const now = input.now ?? Date.now();
	const claim = trimText(input.claim, MAX_CLAIM_CHARS);
	if (!claim) return reference;
	const entry: EvidenceEntry = {
		id: newEvidenceId(now),
		at: now,
		origin: input.origin,
		grade: input.grade,
		tool: input.tool,
		server: input.server,
		probe: input.probe ? trimText(input.probe, 240) : undefined,
		claim,
		anchors: dedupeAnchors(input.anchors ?? []),
		fingerprint: input.fingerprint ?? "",
		bytes: Math.max(0, Math.round(input.bytes ?? 0)),
		excerpt: input.excerpt ? input.excerpt.slice(0, MAX_EXCERPT_CHARS) : undefined,
		truncated: input.excerpt ? input.excerpt.length > MAX_EXCERPT_CHARS : false,
		sessionId: input.sessionId,
	};

	const index = reference.evidence.findIndex((item) => evidenceKey(item) === evidenceKey(entry));
	if (index >= 0) {
		const evidence = reference.evidence.slice();
		evidence[index] = { ...evidence[index]!, at: now };
		return { ...reference, evidence, updatedAt: now };
	}

	return { ...reference, evidence: trimEvidence([...reference.evidence, entry]), updatedAt: now };
}

function dedupeAnchors(anchors: EvidenceAnchor[]): EvidenceAnchor[] {
	const seen = new Set<string>();
	const result: EvidenceAnchor[] = [];
	for (const anchor of anchors) {
		const normalized: EvidenceAnchor = {
			file: anchor.file?.trim() || undefined,
			line: typeof anchor.line === "number" && Number.isFinite(anchor.line) ? Math.max(0, Math.round(anchor.line)) : undefined,
			symbol: anchor.symbol?.trim() || undefined,
			key: anchor.key?.trim() || undefined,
			value: anchor.value === undefined ? undefined : trimText(String(anchor.value), 240),
		};
		if (!normalized.file && !normalized.symbol && !normalized.key) continue;
		const key = JSON.stringify(normalized);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(normalized);
		if (result.length >= 12) break;
	}
	return result;
}

/** Keep manual findings whole; bound the tool noise that grows without limit. */
export function trimEvidence(evidence: EvidenceEntry[]): EvidenceEntry[] {
	const manual = evidence.filter((entry) => entry.origin !== "tool");
	const automatic = evidence.filter((entry) => entry.origin === "tool");
	const keptAutomatic = automatic.slice(Math.max(0, automatic.length - MAX_TOOL_EVIDENCE));
	const keptManual = manual.slice(Math.max(0, manual.length - MAX_MANUAL_EVIDENCE));
	const keep = new Set([...keptAutomatic, ...keptManual].map((entry) => entry.id));
	return evidence.filter((entry) => keep.has(entry.id));
}

export function addUnknown(reference: ReaCase, question: string, now = Date.now()): ReaCase {
	const value = trimText(question, MAX_CLAIM_CHARS);
	if (!value) return reference;
	if (reference.unknowns.some((item) => item === value)) return reference;
	return { ...reference, unknowns: [...reference.unknowns, value].slice(-80), updatedAt: now };
}

export function resolveUnknown(reference: ReaCase, question: string, now = Date.now()): ReaCase {
	const value = trimText(question, MAX_CLAIM_CHARS);
	const unknowns = reference.unknowns.filter((item) => item !== value);
	if (unknowns.length === reference.unknowns.length) return reference;
	return { ...reference, unknowns, updatedAt: now };
}

export function setCaseStatus(reference: ReaCase, status: CaseStatus, now = Date.now()): ReaCase {
	return { ...reference, status, updatedAt: now };
}

export function gradeCounts(reference: Pick<ReaCase, "evidence">): Record<EvidenceGrade, number> {
	const counts: Record<EvidenceGrade, number> = { confirmed: 0, inferred: 0, unknown: 0 };
	for (const entry of reference.evidence) counts[entry.grade] += 1;
	return counts;
}

export function summarizeCase(reference: ReaCase): CaseSummary {
	return {
		id: reference.id,
		title: reference.title,
		target: reference.target,
		route: reference.route,
		status: reference.status,
		updatedAt: reference.updatedAt,
		evidenceCount: reference.evidence.length,
		...gradeCounts(reference),
	};
}

/** Newest last, so a report reads as a timeline of the investigation. */
export function timeline(reference: ReaCase): EvidenceEntry[] {
	return reference.evidence.slice().sort((a, b) => a.at - b.at);
}

export function filterByGrade(reference: ReaCase, grade: EvidenceGrade | "all"): EvidenceEntry[] {
	return grade === "all" ? timeline(reference) : timeline(reference).filter((entry) => entry.grade === grade);
}

/** Defensive read of a stored case; unknown shapes are dropped rather than trusted. */
export function parseStoredCase(raw: unknown): ReaCase | null {
	if (!raw || typeof raw !== "object") return null;
	const value = raw as Partial<ReaCase>;
	if (value.schemaVersion !== 1 || typeof value.id !== "string" || !value.target) return null;
	if (!Array.isArray(value.evidence) || typeof value.goal !== "string") return null;
	const evidence: EvidenceEntry[] = value.evidence
		.filter((entry): entry is EvidenceEntry => Boolean(entry) && typeof entry === "object")
		.filter((entry) => typeof entry.claim === "string" && isEvidenceGrade(entry.grade))
		.map((entry) => ({
			...entry,
			id: typeof entry.id === "string" ? entry.id : newEvidenceId(entry.at ?? Date.now()),
			at: typeof entry.at === "number" ? entry.at : Date.now(),
			origin: entry.origin === "tool" || entry.origin === "user" ? entry.origin : "agent",
			anchors: Array.isArray(entry.anchors) ? dedupeAnchors(entry.anchors) : [],
			fingerprint: typeof entry.fingerprint === "string" ? entry.fingerprint : "",
			bytes: typeof entry.bytes === "number" ? entry.bytes : 0,
		}));
	return {
		schemaVersion: 1,
		id: value.id,
		createdAt: value.createdAt ?? Date.now(),
		updatedAt: value.updatedAt ?? Date.now(),
		title: typeof value.title === "string" ? value.title : "Untitled case",
		target: {
			path: value.target.path,
			kind: value.target.kind ?? "unknown",
			label: value.target.label ?? value.target.path ?? "Untitled target",
			note: value.target.note,
		},
		goal: value.goal,
		route: isReaRoute(value.route) ? value.route : "unknown",
		status: value.status === "closed" ? "closed" : "open",
		evidence,
		unknowns: Array.isArray(value.unknowns) ? value.unknowns.filter((item) => typeof item === "string") : [],
	};
}
