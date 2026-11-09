import { DEFAULT_SETTINGS, normalizeSettings, type WebAccessSettings } from "../domain/settings";

export interface SettingsBackend {
  storage: {
    readFile(path: string, encoding: "utf8"): Promise<string | null>;
    writeFile(path: string, content: string, encoding: "utf8"): Promise<unknown>;
  };
  secrets: {
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    keys(): Promise<string[]>;
  };
}

export const SETTINGS_PATH = "settings.json";

export interface WebAccessStore {
  /** Resolves once the stored file has been read; later calls return the cache. */
  ready(): Promise<WebAccessSettings>;
  snapshot(): WebAccessSettings;
  save(next: WebAccessSettings): Promise<WebAccessSettings>;
  secret(key: string): Promise<string | undefined>;
  secretState(key: string): Promise<"saved" | "missing">;
  setSecret(key: string, value: string): Promise<void>;
  clearSecret(key: string): Promise<void>;
}

export function createSettingsStore(backend: SettingsBackend): WebAccessStore {
  let settings: WebAccessSettings | null = null;
  let loading: Promise<WebAccessSettings> | null = null;
  const secretCache = new Map<string, string | undefined>();

  const load = async (): Promise<WebAccessSettings> => {
    if (settings) return settings;
    loading ??= (async () => {
      let parsed: unknown = {};
      try {
        const raw = await backend.storage.readFile(SETTINGS_PATH, "utf8");
        if (raw) parsed = JSON.parse(raw) as unknown;
      } catch (error) {
        // A corrupt file should not cost the user the default setup; the next
        // save rewrites it.
        console.warn("[web-access] settings.json is unreadable, falling back to defaults", error);
      }
      settings = normalizeSettings(parsed);
      return settings;
    })();
    return loading;
  };

  const readSecret = async (key: string): Promise<string | undefined> => {
    if (secretCache.has(key)) return secretCache.get(key);
    const value = await backend.secrets.get(key);
    secretCache.set(key, value);
    return value;
  };

  return {
    ready: load,
    snapshot: () => settings ?? DEFAULT_SETTINGS,
    async save(next) {
      const normalized = normalizeSettings(next);
      await backend.storage.writeFile(SETTINGS_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
      settings = normalized;
      loading = Promise.resolve(normalized);
      return normalized;
    },
    secret: readSecret,
    async secretState(key) {
      const value = await readSecret(key);
      return value && value.trim() ? "saved" : "missing";
    },
    async setSecret(key, value) {
      const trimmed = value.trim();
      if (!trimmed) {
        await backend.secrets.delete(key);
        secretCache.set(key, undefined);
        return;
      }
      await backend.secrets.set(key, trimmed);
      secretCache.set(key, trimmed);
    },
    async clearSecret(key) {
      await backend.secrets.delete(key);
      secretCache.set(key, undefined);
    }
  };
}
