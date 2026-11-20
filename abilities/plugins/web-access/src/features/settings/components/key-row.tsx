import { useTranslation } from "@vetta-org/plugin-sdk";
import { SettingRow } from "@vetta-org/theme-ui/plugin-ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input
} from "@vetta-org/ui";
import { useState } from "react";
import type { KeyState } from "../hooks/use-web-access-settings";

interface KeyRowProps {
  label: string;
  hint?: string;
  secretKey: string;
  state?: KeyState;
  optional?: boolean;
  border?: boolean;
  onSave(key: string, value: string): Promise<void>;
  onClear(key: string): Promise<void>;
}

/**
 * One provider's credential: a host setting row that opens a host dialog to
 * enter the key. No password field sits on the page permanently — five visible
 * password fields read as a form to fill in, which is what this page is not.
 */
export function KeyRow({ label, hint, secretKey, state, optional, border = true, onSave, onClear }: KeyRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = state === "saved";

  const close = () => {
    setEditing(false);
    setValue("");
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      close();
    } catch {
      // The page-level message reports the failure; keep the dialog open so the
      // pasted value is not lost.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingRow
        title={label}
        description={saved ? t("settings.key.saved") : (hint ?? t("settings.key.missing"))}
        border={border}
      >
        <div className="flex items-center gap-1.5">
          {optional ? <span className="text-[11px] text-muted-foreground">{t("settings.key.optional")}</span> : null}
          <Button type="button" variant="field" onClick={() => setEditing(true)}>
            {saved ? t("settings.key.change") : t("settings.key.add")}
          </Button>
        </div>
      </SettingRow>

      <Dialog open={editing} onOpenChange={(open) => (open ? setEditing(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            {hint ? <DialogDescription>{hint}</DialogDescription> : null}
          </DialogHeader>
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            aria-label={label}
            placeholder={t("settings.key.placeholder")}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && value.trim() && !busy) void run(() => onSave(secretKey, value));
            }}
          />
          <DialogFooter>
            {saved ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void run(() => onClear(secretKey))}
              >
                {t("settings.key.clear")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={close}>
              {t("settings.key.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy || !value.trim()}
              onClick={() => void run(() => onSave(secretKey, value))}
            >
              {t("settings.key.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
