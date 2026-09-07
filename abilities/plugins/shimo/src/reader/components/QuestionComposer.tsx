import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spin,
} from "@vetta/ui";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { locationLabel } from "../prompts";
import type { Locale, PendingQuestion } from "../types";

interface QuestionComposerProps {
  pending: PendingQuestion;
  locale: Locale;
  t: PluginTranslate;
  modelAvailable: boolean;
  onCancel(): void;
  onSubmit(question: string): Promise<void>;
}

export function QuestionComposer({
  pending,
  locale,
  t,
  modelAvailable,
  onCancel,
  onSubmit,
}: QuestionComposerProps): ReactElement {
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => textareaRef.current?.focus(), []);

  const submit = async (): Promise<void> => {
    const value = question.trim();
    if (!value || !modelAvailable || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(value);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onCancel(); }}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="px-5 pb-0 pt-5">
          <DialogTitle className="shimo-serif text-lg">{t("question.title")}</DialogTitle>
          <DialogDescription>{t("question.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5">
          <blockquote className="shimo-serif max-h-28 overflow-y-auto rounded-xl border-l-2 border-primary/35 bg-muted/40 px-3 py-2.5 text-sm leading-relaxed">
            {pending.selection.quote}
          </blockquote>
          <p className="text-[10px] text-muted-foreground">{locationLabel(pending.selection.anchor, locale)}</p>
          <textarea
            ref={textareaRef}
            value={question}
            rows={5}
            placeholder={t("question.placeholder")}
            aria-label={t("question.inputLabel")}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
          {!modelAvailable ? <p className="text-xs text-destructive">{t("ai.modelRequired")}</p> : null}
        </div>

        <DialogFooter className="border-t border-border/50 bg-muted/20 px-5 py-3">
          <span className="mr-auto self-center text-[10px] text-muted-foreground">{t("composer.shortcut")}</span>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>{t("common.cancel")}</Button>
          <Button type="button" onClick={() => void submit()} disabled={!question.trim() || !modelAvailable || submitting}>
            {submitting ? <><Spin size="sm" />{t("question.answering")}</> : t("question.ask")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
