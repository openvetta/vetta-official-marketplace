/**
 * Case persistence on the plugin's private storage.
 *
 * One file per case keeps writes small and lets the board load a single case;
 * the index is a materialised list of summaries so the rail never reads every
 * case file. Both are published together with `commit()` so they cannot drift.
 */

import { getPluginContext } from "../plugin-context";
import {
	parseStoredCase,
	summarizeCase,
	type CaseSummary,
	type ReaCase,
} from "../domain/case-model";

const INDEX_PATH = "index.json";
const STATE_PATH = "state.json";
const CASE_DIR = "cases";

interface IndexFile {
	schemaVersion: 1;
	cases: CaseSummary[];
}

interface StateFile {
	schemaVersion: 1;
	/** Last case opened per workspace root, so reopening a project resumes the thread. */
	activeByCwd: Record<string, string>;
}

const EMPTY_INDEX: IndexFile = { schemaVersion: 1, cases: [] };
const EMPTY_STATE: StateFile = { schemaVersion: 1, activeByCwd: {} };

export type CaseStoreEvent =
	| { type: "case-saved"; caseId: string }
	| { type: "case-removed"; caseId: string }
	| { type: "active-changed"; caseId: string | null; cwd: string | null };

const listeners = new Set<(event: CaseStoreEvent) => void>();

export function subscribeCases(listener: (event: CaseStoreEvent) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function emit(event: CaseStoreEvent): void {
	for (const listener of listeners) {
		try {
			listener(event);
		} catch (error) {
			console.warn("[rea] case listener failed", error);
		}
	}
}

/** Storage calls are serialised: case + index must never interleave across writers. */
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(task: () => Promise<T>): Promise<T> {
	const next = queue.then(task, task);
	queue = next.catch(() => undefined);
	return next;
}

function casePath(id: string): string {
	return `${CASE_DIR}/${id}.json`;
}

async function readIndex(): Promise<IndexFile> {
	const storage = getPluginContext().storage;
	const raw = await storage.readFile(INDEX_PATH, "utf8");
	if (!raw) return EMPTY_INDEX;
	try {
		const parsed = JSON.parse(raw) as IndexFile;
		if (!parsed || !Array.isArray(parsed.cases)) return EMPTY_INDEX;
		return { schemaVersion: 1, cases: parsed.cases.filter((item) => typeof item?.id === "string") };
	} catch {
		return EMPTY_INDEX;
	}
}

async function readState(): Promise<StateFile> {
	const storage = getPluginContext().storage;
	const raw = await storage.readFile(STATE_PATH, "utf8");
	if (!raw) return EMPTY_STATE;
	try {
		const parsed = JSON.parse(raw) as StateFile;
		return { schemaVersion: 1, activeByCwd: parsed?.activeByCwd ?? {} };
	} catch {
		return EMPTY_STATE;
	}
}

function upsertSummary(index: IndexFile, reference: ReaCase): IndexFile {
	const summary = summarizeCase(reference);
	const cases = index.cases.filter((item) => item.id !== reference.id);
	cases.push(summary);
	cases.sort((a, b) => b.updatedAt - a.updatedAt);
	return { schemaVersion: 1, cases };
}

export function listCaseSummaries(): Promise<CaseSummary[]> {
	return serial(async () => (await readIndex()).cases);
}

export async function loadCase(caseId: string): Promise<ReaCase | null> {
	const storage = getPluginContext().storage;
	const raw = await storage.readFile(casePath(caseId), "utf8");
	if (!raw) return null;
	try {
		return parseStoredCase(JSON.parse(raw));
	} catch {
		return null;
	}
}

export function saveCase(reference: ReaCase): Promise<ReaCase> {
	return serial(async () => {
		const storage = getPluginContext().storage;
		const index = await readIndex();
		await storage.commit([
			{ type: "write", path: casePath(reference.id), data: JSON.stringify(reference), encoding: "utf8" },
			{
				type: "write",
				path: INDEX_PATH,
				data: JSON.stringify(upsertSummary(index, reference)),
				encoding: "utf8",
			},
		]);
		emit({ type: "case-saved", caseId: reference.id });
		return reference;
	});
}

/** Read-modify-write of one case under the same lock as `saveCase`. */
export function updateCase(caseId: string, mutate: (reference: ReaCase) => ReaCase | null): Promise<ReaCase | null> {
	return serial(async () => {
		const storage = getPluginContext().storage;
		const raw = await storage.readFile(casePath(caseId), "utf8");
		if (!raw) return null;
		let parsed: ReaCase | null = null;
		try {
			parsed = parseStoredCase(JSON.parse(raw));
		} catch {
			parsed = null;
		}
		if (!parsed) return null;
		const next = mutate(parsed);
		if (!next) return parsed;
		const index = await readIndex();
		await storage.commit([
			{ type: "write", path: casePath(caseId), data: JSON.stringify(next), encoding: "utf8" },
			{ type: "write", path: INDEX_PATH, data: JSON.stringify(upsertSummary(index, next)), encoding: "utf8" },
		]);
		emit({ type: "case-saved", caseId });
		return next;
	});
}

export function deleteCase(caseId: string): Promise<void> {
	return serial(async () => {
		const storage = getPluginContext().storage;
		const index = await readIndex();
		await storage.commit([
			{ type: "remove", path: casePath(caseId) },
			{
				type: "write",
				path: INDEX_PATH,
				data: JSON.stringify({ schemaVersion: 1, cases: index.cases.filter((item) => item.id !== caseId) }),
				encoding: "utf8",
			},
		]);
		emit({ type: "case-removed", caseId });
	});
}

export function getActiveCaseId(cwd: string | null): Promise<string | null> {
	return serial(async () => {
		const state = await readState();
		if (!cwd) {
			const recent = Object.values(state.activeByCwd).sort();
			return recent.length > 0 ? recent[recent.length - 1]! : null;
		}
		return state.activeByCwd[cwd] ?? null;
	});
}

export function setActiveCaseId(cwd: string | null, caseId: string | null): Promise<void> {
	return serial(async () => {
		const state = await readState();
		const activeByCwd = { ...state.activeByCwd };
		if (cwd) {
			if (caseId) activeByCwd[cwd] = caseId;
			else delete activeByCwd[cwd];
		}
		const storage = getPluginContext().storage;
		await storage.writeFile(STATE_PATH, JSON.stringify({ schemaVersion: 1, activeByCwd }), "utf8");
		emit({ type: "active-changed", caseId, cwd });
	});
}
