import { useCallback, useEffect, useState } from "react";
import type { WebAccessSettings } from "../../../domain/settings";
import type { WebAccessStore } from "../../../services/settings-store";

export type KeyState = "saved" | "missing";

export interface SettingsForm {
  settings: WebAccessSettings;
  keys: Record<string, KeyState>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  dirty: boolean;
  update(patch: Partial<WebAccessSettings>): void;
  save(): Promise<void>;
  saveKey(key: string, value: string): Promise<void>;
  clearKey(key: string): Promise<void>;
}

export const TRACKED_KEYS = ["exaApiKey", "braveApiKey", "tavilyApiKey", "bochaApiKey", "jinaApiKey"] as const;

export function useWebAccessSettings(store: WebAccessStore): SettingsForm {
  const [settings, setSettings] = useState<WebAccessSettings>(() => store.snapshot());
  const [keys, setKeys] = useState<Record<string, KeyState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const refreshKeyStates = useCallback(async () => {
    const entries = await Promise.all(
      TRACKED_KEYS.map(async (key) => [key, await store.secretState(key)] as const)
    );
    setKeys(Object.fromEntries(entries));
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    store
      .ready()
      .then(async (loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        await refreshKeyStates();
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [store, refreshKeyStates]);

  const update = useCallback((patch: Partial<WebAccessSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      setSettings(await store.save(settings));
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [settings, store]);

  const saveKey = useCallback(
    async (key: string, value: string) => {
      setError(null);
      try {
        await store.setSecret(key, value);
        await refreshKeyStates();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        throw cause;
      }
    },
    [store, refreshKeyStates]
  );

  const clearKey = useCallback(
    async (key: string) => {
      setError(null);
      try {
        await store.clearSecret(key);
        await refreshKeyStates();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        throw cause;
      }
    },
    [store, refreshKeyStates]
  );

  return { settings, keys, loading, saving, error, dirty, update, save, saveKey, clearKey };
}
