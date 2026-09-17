import type { ProtocolGroup } from "./provider-contract";
import type { ManagedPluginContext } from "./runtime-contract";

const SELECTION_KEY = "published-models.json";

export type ModelRouteKey = `${ProtocolGroup}/${string}`;
export type ModelSelection =
  | { mode: "all" }
  | { mode: "custom"; routes: ReadonlySet<ModelRouteKey> }
  | { mode: "legacy"; ids: ReadonlySet<string> };

type StoredSelectionV1 = { schemaVersion: 1; models: string[] };
type StoredSelectionV2 =
  | { schemaVersion: 2; mode: "all"; routes: [] }
  | { schemaVersion: 2; mode: "custom"; routes: ModelRouteKey[] };

export function modelRouteKey(model: { id: string; group: ProtocolGroup }): ModelRouteKey {
  return `${model.group}/${model.id}`;
}

export async function readModelSelection(context: ManagedPluginContext): Promise<ModelSelection> {
  try {
    const raw = await context.storage.readFile(SELECTION_KEY, "utf8");
    if (raw === null) return { mode: "all" };
    const stored = JSON.parse(raw) as StoredSelectionV1 | StoredSelectionV2;
    if (stored.schemaVersion === 2 && stored.mode === "all") return { mode: "all" };
    if (stored.schemaVersion === 2 && stored.mode === "custom" && Array.isArray(stored.routes)) {
      return {
        mode: "custom",
        routes: new Set(stored.routes.filter((route): route is ModelRouteKey =>
          typeof route === "string" && /^(google|anthropic|responses|completions)\/.+/u.test(route)))
      };
    }
    if (stored.schemaVersion === 1 && Array.isArray(stored.models)) {
      return {
        mode: "legacy",
        ids: new Set(stored.models.filter((id): id is string => typeof id === "string" && id.length > 0))
      };
    }
    return { mode: "all" };
  } catch {
    return { mode: "all" };
  }
}

export async function writeModelSelection(context: ManagedPluginContext, selection: ModelSelection): Promise<void> {
  const stored: StoredSelectionV2 = selection.mode === "all"
    ? { schemaVersion: 2, mode: "all", routes: [] }
    : {
        schemaVersion: 2,
        mode: "custom",
        routes: [...(selection.mode === "custom" ? selection.routes : [])]
          .sort((left, right) => left.localeCompare(right))
      };
  await context.storage.writeFile(SELECTION_KEY, JSON.stringify(stored, null, 2), "utf8");
}

/** Expands a v1 bare model id to every matching protocol route after a complete catalog read. */
export function migrateLegacySelection<T extends { id: string; group: ProtocolGroup }>(
  selection: ModelSelection,
  models: readonly T[],
): ModelSelection {
  if (selection.mode !== "legacy") return selection;
  return {
    mode: "custom",
    routes: new Set(models.filter((model) => selection.ids.has(model.id)).map(modelRouteKey))
  };
}

export function selectModels<T extends { id: string; group: ProtocolGroup }>(
  models: readonly T[],
  selection: ModelSelection,
): T[] {
  if (selection.mode === "all") return [...models];
  if (selection.mode === "legacy") return models.filter((model) => selection.ids.has(model.id));
  return models.filter((model) => selection.routes.has(modelRouteKey(model)));
}
