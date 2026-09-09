import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@vetta/ui";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { locationLabel } from "../prompts";
import type { Locale, PendingNote } from "../types";

interface NoteComposerProps {
  pending: PendingNote;
  locale: Locale;
  t: PluginTranslate;
  onCancel(): void;
  onSave(body: string): Promise<void>;
}

export function NoteComposer({ pending, locale, t, onCancel, onSave }: NoteComposerProps): ReactElement {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => textareaRef.current?.focus(), []);

  const save = async (): Promise<void> => {
    const value = body.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  };

  const kindKey = pending.kind === "reflection" ? "composer.reflectionTitle" : "composer.noteTitle";

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onCancel(); }}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="px-5 pb-0 pt-5">
          <DialogTitle className="font-serif text-lg">{t(kindKey)}</DialogTitle>
          <DialogDescription>{t("composer.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5">
          <blockquote className="max-h-28 overflow-y-auto rounded-xl border-l-2 border-primary/35 bg-muted/40 px-3 py-2.5 font-serif text-sm leading-relaxed">
            {pending.selection.quote}
          </blockquote>
          <p className="text-[10px] text-muted-foreground">
            {locationLabel(pending.selection.anchor, locale)}
          </p>
          <textarea
            ref={textareaRef}
            value={body}
            rows={7}
            placeholder={t("composer.placeholder")}
            aria-label={t("composer.inputLabel")}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <DialogFooter className="border-t border-border/50 bg-muted/20 px-5 py-3">
          <span className="mr-auto self-center text-[10px] text-muted-foreground">{t("composer.shortcut")}</span>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>{t("common.cancel")}</Button>
          <Button type="button" onClick={() => void save()} disabled={!body.trim() || saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
