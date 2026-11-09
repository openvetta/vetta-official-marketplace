import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { createSettingsStore, type SettingsBackend } from "../services/settings-store";

function memoryBackend(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  const secrets = new Map<string, string>();
  const backend: SettingsBackend = {
    storage: {
      readFile: async (path) => files.get(path) ?? null,
      writeFile: async (path, content) => {
        files.set(path, content);
      }
    },
    secrets: {
      get: async (key) => secrets.get(key),
      set: async (key, value) => {
        secrets.set(key, value);
      },
      delete: async (key) => {
        secrets.delete(key);
      },
      keys: async () => [...secrets.keys()]
    }
  };
  return { backend, files, secrets };
}

describe("settings store", () => {
  it("loads defaults when there is no file", async () => {
    const { backend } = memoryBackend();
    const store = createSettingsStore(backend);
    expect(await store.ready()).toEqual(DEFAULT_SETTINGS);
  });

  it("normalizes a hand-edited file", async () => {
    const { backend } = memoryBackend({
      "settings.json": JSON.stringify({ searchProvider: "bocha", resultCount: 50 })
    });
    const store = createSettingsStore(backend);
    const settings = await store.ready();
    expect(settings.searchProvider).toBe("bocha");
    expect(settings.resultCount).toBe(DEFAULT_SETTINGS.resultCount);
  });

  it("round-trips saved settings and keeps keys out of the file", async () => {
    const { backend, files, secrets } = memoryBackend();
    const store = createSettingsStore(backend);
    await store.ready();
    await store.save({ ...DEFAULT_SETTINGS, searchProvider: "tavily", resultCount: 4 });
    await store.setSecret("tavilyApiKey", " secret ");

    const raw = files.get("settings.json") ?? "";
    expect(JSON.parse(raw)).toMatchObject({ searchProvider: "tavily", resultCount: 4 });
    expect(raw).not.toContain("secret");
    expect(secrets.get("tavilyApiKey")).toBe("secret");

    const reloaded = createSettingsStore(backend);
    expect((await reloaded.ready()).resultCount).toBe(4);
    expect(await reloaded.secretState("tavilyApiKey")).toBe("saved");
  });

  it("treats an empty or cleared key as missing", async () => {
    const { backend } = memoryBackend();
    const store = createSettingsStore(backend);
    await store.setSecret("exaApiKey", "   ");
    expect(await store.secretState("exaApiKey")).toBe("missing");
    await store.setSecret("exaApiKey", "key");
    await store.clearSecret("exaApiKey");
    expect(await store.secretState("exaApiKey")).toBe("missing");
  });

  it("recovers from a corrupt file", async () => {
    const { backend } = memoryBackend({ "settings.json": "{not json" });
    const store = createSettingsStore(backend);
    expect(await store.ready()).toEqual(DEFAULT_SETTINGS);
  });
});
