import { describe, expect, it, vi } from "vitest";
import {
  migrateLegacySelection,
  readModelSelection,
  selectModels,
  writeModelSelection,
} from "../src/model-selection";
import type { ManagedPluginContext } from "../src/runtime-contract";

function context(raw: string | null) {
  const writeFile = vi.fn(async () => undefined);
  return {
    value: {
      storage: { readFile: vi.fn(async () => raw), writeFile },
    } as unknown as ManagedPluginContext,
    writeFile,
  };
}

const routes = [
  { id: "shared", group: "google" as const },
  { id: "shared", group: "anthropic" as const },
  { id: "future", group: "responses" as const },
];

describe("model selection", () => {
  it("migrates each v1 bare id to every matching protocol route", async () => {
    const fixture = context(JSON.stringify({ schemaVersion: 1, models: ["shared"] }));
    const legacy = await readModelSelection(fixture.value);
    const migrated = migrateLegacySelection(legacy, routes);
    expect(migrated).toEqual({
      mode: "custom",
      routes: new Set(["google/shared", "anthropic/shared"]),
    });
    await writeModelSelection(fixture.value, migrated);
    expect(fixture.writeFile).toHaveBeenCalledWith(
      "published-models.json",
      JSON.stringify({ schemaVersion: 2, mode: "custom", routes: ["anthropic/shared", "google/shared"] }, null, 2),
      "utf8",
    );
  });

  it("all mode includes routes discovered after the setting was saved", () => {
    expect(selectModels(routes, { mode: "all" })).toEqual(routes);
    expect(selectModels(routes, { mode: "custom", routes: new Set(["google/shared"]) })).toEqual([routes[0]]);
  });
});
