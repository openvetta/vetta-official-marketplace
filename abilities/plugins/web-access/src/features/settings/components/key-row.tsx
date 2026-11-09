import { useState } from "react";
import { useTranslation } from "@vetta-org/plugin-sdk";
import type { KeyState } from "../hooks/use-web-access-settings";

interface KeyRowProps {
  label: string;
  hint?: string;
  monogram: string;
  secretKey: string;
  state?: KeyState;
  optional?: boolean;
  onSave(key: string, value: string): Promise<void>;
  onClear(key: string): Promise<void>;
}

/**
 * One provider's credential. The input only exists while you are editing it —
 * five permanently visible password fields read as a form to fill in, which is
 * exactly what this page is trying not to be.
 */
export function KeyRow({ label, hint, monogram, secretKey, state, optional, onSave, onClear }: KeyRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = state === "saved";

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setValue("");
      setEditing(false);
    } catch {
      // The page-level banner reports the failure; keep the field open so the
      // pasted value is not lost.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
          {monogram}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">{label}</span>
            {optional ? (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                {t("settings.key.optional")}
              </span>
            ) : null}
          </div>
          {hint && !editing ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 text-[10px] font-medium ${
            saved ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${saved ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
          {saved ? t("settings.key.saved") : t("settings.key.missing")}
        </span>
        {saved && !editing ? (
          <button
            type="button"
            disabled={busy}
            className="shrink-0 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setEditing(true)}
          >
            {t("settings.key.change")}
          </button>
        ) : null}
        {!saved && !editing ? (
          <button
            type="button"
            className="shrink-0 rounded-md border border-border/70 px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            onClick={() => setEditing(true)}
          >
            {t("settings.key.add")}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2.5 space-y-2 border-t border-border/50 pt-2.5">
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            placeholder={t("settings.key.placeholder")}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && value.trim() && !busy) void run(() => onSave(secretKey, value));
              if (event.key === "Escape") setEditing(false);
            }}
          />
          <div className="flex items-center justify-end gap-2">
            {saved ? (
              <button
                type="button"
                disabled={busy}
                className="rounded-md px-2 py-1 text-[11px] text-destructive transition-colors hover:bg-destructive/10"
                onClick={() => void run(() => onClear(secretKey))}
              >
                {t("settings.key.clear")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => {
                setEditing(false);
                setValue("");
              }}
            >
              {t("settings.key.cancel")}
            </button>
            <button
              type="button"
              disabled={busy || !value.trim()}
              className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
              onClick={() => void run(() => onSave(secretKey, value))}
            >
              {t("settings.key.save")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
