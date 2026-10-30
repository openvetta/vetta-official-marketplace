/**
 * Turning raw REA tool traffic into evidence.
 *
 * An REA response is large, nested and full of the tool's own vocabulary. The
 * board cannot store it and the model should not re-read it: what matters is the
 * one-line observation, the pointers it rests on, and a fingerprint that makes
 * a repeated (or drifted) result recognisable.
 */

import { MAX_EXCERPT_CHARS, MAX_CLAIM_CHARS, trimText, type EvidenceAnchor, type EvidenceGrade } from "./case-model";

// `mcp__<server>__<tool>` and `mcp_<server>_<tool>`; the server segment is matched
// lazily so a tool name that itself contains underscores survives intact.
const TOOL_PREFIXES = [/^mcp__[a-z0-9_-]+?__/iu, /^mcp_[a-z0-9_-]+?_/iu];

export function shortToolName(name: string): string {
	let value = name.trim();
	for (const prefix of TOOL_PREFIXES) {
		const next = value.replace(prefix, "");
		if (next !== value) {
			value = next;
			break;
		}
	}
	return value || "tool";
}

/** REA's bundled MCP server is declared as `rea`; accept the client naming variants. */
export function isReaServer(serverName: string | undefined, hostToolName: string): boolean {
	if (serverName && /rea/iu.test(serverName)) return true;
	return /^(?:mcp__rea__|mcp_rea_)/iu.test(hostToolName);
}

/** Order-independent JSON so the same payload always yields the same fingerprint. */
export function stableStringify(value: unknown, depth = 0): string {
	if (value === null) return "null";
	const type = typeof value;
	if (type === "string") return JSON.stringify(value);
	if (type === "number" || type === "boolean") return String(value);
	if (type === "bigint") return `${(value as bigint).toString()}n`;
	if (type === "function" || type === "undefined" || type === "symbol") return "null";
	if (depth > 6) return '"[deep]"';
	if (Array.isArray(value)) {
		const items = value.slice(0, 200).map((item) => stableStringify(item, depth + 1));
		return `[${items.join(",")}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	const rendered = entries.slice(0, 200).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item, depth + 1)}`);
	return `{${rendered.join(",")}}`;
}

/** FNV-1a 64-bit, hex encoded. A change detector, not a security hash. */
export function fingerprint(value: unknown): string {
	const text = stableStringify(value);
	let hash = 0xcbf29ce484222325n;
	const prime = 0x100000001b3n;
	const mask = 0xffffffffffffffffn;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= BigInt(text.charCodeAt(index) & 0xff);
		hash = (hash * prime) & mask;
	}
	return hash.toString(16).padStart(16, "0");
}

const SUMMARY_KEYS = ["summary", "headline", "title", "message", "description", "status", "state", "finding"] as const;

function readable(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return null;
}

/** A short factual line about what the tool returned. */
export function describeResponse(tool: string, response: unknown): string {
	if (response === null || response === undefined) return `${tool} returned no payload`;
	if (typeof response === "string") return `${tool} → ${trimText(response, 220)}`;
	if (Array.isArray(response)) {
		const first = response[0];
		const hint = first && typeof first === "object" ? Object.keys(first as object).slice(0, 4).join(", ") : "";
		return `${tool} → ${response.length} item${response.length === 1 ? "" : "s"}${hint ? ` (${hint})` : ""}`;
	}
	if (typeof response === "object") {
		const record = response as Record<string, unknown>;
		for (const key of SUMMARY_KEYS) {
			const text = readable(record[key]);
			if (text) return `${tool} → ${trimText(text, 220)}`;
		}
		const keys = Object.keys(record).slice(0, 6);
		if (keys.length === 0) return `${tool} → empty object`;
		return `${tool} → ${keys.map((key) => `${key}: ${typeName(record[key])}`).join(", ")}`;
	}
	return `${tool} → ${typeof response}`;
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return `array(${value.length})`;
	if (typeof value === "object") return "object";
	return typeof value;
}

const FILE_KEYS = ["file", "path", "filePath", "source", "location", "script"] as const;
const LINE_KEYS = ["line", "lineNumber", "offset", "address", "rva", "start"] as const;
const SYMBOL_KEYS = ["symbol", "name", "function", "method", "module", "className"] as const;
const POINTER_KEYS = ["selector", "key", "id", "hash", "sha256", "buildId"] as const;

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
	}
	return undefined;
}

/** Collect file/symbol pointers from a nested response, breadth-first and bounded. */
export function extractAnchors(response: unknown, limit = 10): EvidenceAnchor[] {
	const anchors: EvidenceAnchor[] = [];
	const queue: unknown[] = [response];
	let visited = 0;
	while (queue.length > 0 && anchors.length < limit && visited < 400) {
		const current = queue.shift();
		visited += 1;
		if (Array.isArray(current)) {
			queue.push(...current.slice(0, 40));
			continue;
		}
		if (!current || typeof current !== "object") continue;
		const record = current as Record<string, unknown>;
		const file = firstString(record, FILE_KEYS);
		const symbol = firstString(record, SYMBOL_KEYS);
		const pointerKey = POINTER_KEYS.find((key) => typeof record[key] === "string" && String(record[key]).trim());
		if (file || symbol || pointerKey) {
			anchors.push({
				file: file && /[\\/]/u.test(file) ? file : undefined,
				line: firstNumber(record, LINE_KEYS),
				symbol: symbol && !/^\d+$/u.test(symbol) ? trimText(symbol, 120) : undefined,
				key: pointerKey && !file ? pointerKey : undefined,
				value: pointerKey ? trimText(String(record[pointerKey]), 160) : undefined,
			});
		}
		for (const value of Object.values(record)) {
			if (value && typeof value === "object") queue.push(value);
		}
	}
	return anchors;
}

export interface NormalizedObservation {
	tool: string;
	claim: string;
	grade: EvidenceGrade;
	fingerprint: string;
	bytes: number;
	excerpt: string;
	truncated: boolean;
	anchors: EvidenceAnchor[];
	failed: boolean;
}

function byteSize(response: unknown): number {
	try {
		const text = typeof response === "string" ? response : JSON.stringify(response);
		return text ? new TextEncoder().encode(text).length : 0;
	} catch {
		return 0;
	}
}

function pretty(response: unknown): string {
	if (typeof response === "string") return response;
	try {
		return JSON.stringify(response, null, 1) ?? "";
	} catch {
		return String(response);
	}
}

export function normalizeToolResponse(toolName: string, response: unknown): NormalizedObservation {
	const tool = shortToolName(toolName);
	const text = pretty(response);
	const bytes = byteSize(response);
	const failed = Boolean(
		response && typeof response === "object" && !Array.isArray(response) && (response as Record<string, unknown>).error,
	);
	return {
		tool,
		claim: trimText(describeResponse(tool, response), MAX_CLAIM_CHARS),
		// Reaching the tool and getting a payload back is an observation; only the
		// agent's interpretation of it is an inference.
		grade: failed ? "unknown" : "confirmed",
		fingerprint: fingerprint(response),
		bytes,
		excerpt: text.slice(0, MAX_EXCERPT_CHARS),
		truncated: text.length > MAX_EXCERPT_CHARS,
		anchors: extractAnchors(response),
		failed,
	};
}

export function normalizeToolFailure(toolName: string, error: string): NormalizedObservation {
	const tool = shortToolName(toolName);
	const claim = trimText(`${tool} failed → ${error || "unknown error"}`, MAX_CLAIM_CHARS);
	return {
		tool,
		claim,
		grade: "unknown",
		fingerprint: fingerprint({ tool, error }),
		bytes: byteSize(error),
		excerpt: trimText(error, MAX_EXCERPT_CHARS),
		truncated: error.length > MAX_EXCERPT_CHARS,
		anchors: [],
		failed: true,
	};
}

/** Input shape worth keeping for replay: the arguments identify the probe. */
export function describeProbe(input: unknown): string {
	if (!input || typeof input !== "object") return "";
	const record = input as Record<string, unknown>;
	const interesting = ["path", "file", "target", "query", "address", "symbol", "selector", "sessionId"].filter(
		(key) => typeof record[key] === "string" || typeof record[key] === "number",
	);
	if (interesting.length === 0) return "";
	return interesting
		.slice(0, 3)
		.map((key) => `${key}=${trimText(String(record[key]), 80)}`)
		.join(" ");
}
