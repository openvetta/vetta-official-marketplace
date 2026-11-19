import { useTranslation } from "@vetta-org/plugin-sdk";
import { Button, Input } from "@vetta-org/ui";
import { useState } from "react";
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
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2.5">
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
          <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={() => setEditing(true)}>
            {t("settings.key.change")}
          </Button>
        ) : null}
        {!saved && !editing ? (
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            {t("settings.key.add")}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2.5 space-y-2 border-t border-border/50 pt-2.5">
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            autoFocus
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
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={busy}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void run(() => onClear(secretKey))}
              >
                {t("settings.key.clear")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setValue("");
              }}
            >
              {t("settings.key.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="xs"
              disabled={busy || !value.trim()}
              onClick={() => void run(() => onSave(secretKey, value))}
            >
              {t("settings.key.save")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
