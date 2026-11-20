import { useCallback, useEffect, useRef, useState } from "react";
import type { WebAccessSettings } from "../../../domain/settings";
import type { WebAccessStore } from "../../../services/settings-store";

export type KeyState = "saved" | "missing";

/** Everything is written as soon as it changes; this is only the user-facing hint. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SettingsForm {
  settings: WebAccessSettings;
  keys: Record<string, KeyState>;
  loading: boolean;
  status: SaveStatus;
  error: string | null;
  update(patch: Partial<WebAccessSettings>): void;
  saveKey(key: string, value: string): Promise<void>;
  clearKey(key: string): Promise<void>;
}

export const TRACKED_KEYS = ["exaApiKey", "braveApiKey", "tavilyApiKey", "bochaApiKey", "jinaApiKey"] as const;

/**
 * Coalescing window for writes. Controls that commit in one go (select, switch,
 * stepper) and text fields both land here, so a burst of typing becomes one write
 * instead of one per keystroke.
 */
const WRITE_DELAY_MS = 300;

/**
 * The page has no save button: every edit is persisted on its own. Writes are
 * serialized — while one is in flight, later edits queue behind it and the last
 * state wins, so a slow disk never leaves an older snapshot behind a newer one.
 */
export function useWebAccessSettings(store: WebAccessStore): SettingsForm {
  const [settings, setSettings] = useState<WebAccessSettings>(() => store.snapshot());
  const [keys, setKeys] = useState<Record<string, KeyState>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const pending = useRef<WebAccessSettings | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (pending.current) {
        const next = pending.current;
        pending.current = null;
        setStatus("saving");
        try {
          await store.save(next);
          setError(null);
          setStatus(pending.current ? "saving" : "saved");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setStatus("error");
          return;
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [store]);

  const schedule = useCallback(
    (next: WebAccessSettings) => {
      pending.current = next;
      setStatus("saving");
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        void flush();
      }, WRITE_DELAY_MS);
    },
    [flush]
  );

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

  // Leaving the page must not drop the last edit still inside the coalescing window.
  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      if (pending.current) {
        const next = pending.current;
        pending.current = null;
        void store.save(next).catch(() => undefined);
      }
    },
    [store]
  );

  const update = useCallback(
    (patch: Partial<WebAccessSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        schedule(next);
        return next;
      });
    },
    [schedule]
  );

  const runKeyAction = useCallback(
    async (action: () => Promise<void>) => {
      setError(null);
      try {
        await action();
        await refreshKeyStates();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        throw cause;
      }
    },
    [refreshKeyStates]
  );

  const saveKey = useCallback(
    (key: string, value: string) => runKeyAction(() => store.setSecret(key, value)),
    [runKeyAction, store]
  );

  const clearKey = useCallback((key: string) => runKeyAction(() => store.clearSecret(key)), [runKeyAction, store]);

  return { settings, keys, loading, status, error, update, saveKey, clearKey };
}
