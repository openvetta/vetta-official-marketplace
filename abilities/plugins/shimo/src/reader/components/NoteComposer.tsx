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
      <DialogContent className="overflow-hidden rounded-none p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="px-6 pb-0 pt-6">
          <DialogTitle className="font-serif text-xl font-medium tracking-wide">{t(kindKey)}</DialogTitle>
          <DialogDescription>{t("composer.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6">
          <blockquote className="max-h-28 overflow-y-auto rounded-r-lg border-l-2 border-primary/50 bg-muted/20 py-2 pl-3.5 pr-3 font-serif text-sm leading-6 text-foreground/90">
            {pending.selection.quote}
          </blockquote>
          <p className="text-[10px] tracking-wide text-muted-foreground">
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
            className="w-full resize-none border border-input bg-background px-3.5 py-3 font-serif text-sm leading-7 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <DialogFooter className="border-t border-border/50 px-6 py-3">
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
