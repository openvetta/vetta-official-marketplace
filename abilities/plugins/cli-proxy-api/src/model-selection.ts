import type { ManagedPluginContext } from "./runtime-contract";

const SELECTION_KEY = "published-models.json";

/**
 * Which discovered models get published to Vetta.
 *
 * `null` means "everything the gateway routes" — the behaviour before the picker
 * existed, and the right default for a gateway nobody has curated yet. A set is
 * an explicit choice, and it is stored rather than held in memory because the
 * service republishes on its own every time it comes up: without a persisted
 * choice, the next start would quietly put the unselected models back.
 */
export type ModelSelection = ReadonlySet<string> | null;

type StoredSelection = { schemaVersion: 1; models: string[] };

export async function readModelSelection(context: ManagedPluginContext): Promise<ModelSelection> {
  try {
		const raw = await context.storage.readFile(SELECTION_KEY, "utf8");
		const stored = raw === null ? null : (JSON.parse(raw) as StoredSelection);
    if (!stored || !Array.isArray(stored.models)) return null;
    return new Set(stored.models.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    // Unreadable storage must not cost the user their models: fall back to all.
    return null;
  }
}

export async function writeModelSelection(context: ManagedPluginContext, ids: Iterable<string>): Promise<void> {
  const models = [...new Set(ids)].sort((left, right) => left.localeCompare(right));
	await context.storage.writeFile(
		SELECTION_KEY,
		JSON.stringify({ schemaVersion: 1, models } satisfies StoredSelection, null, 2),
		"utf8",
	);
}

/** Applies a selection to a discovered catalog. `null` keeps every model. */
export function selectModels<T extends { id: string }>(models: readonly T[], selection: ModelSelection): T[] {
  if (!selection) return [...models];
  return models.filter((model) => selection.has(model.id));
}
