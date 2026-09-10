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
      <DialogContent className="overflow-hidden rounded-none p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="px-6 pb-0 pt-6">
          <DialogTitle className="font-serif text-xl font-medium tracking-wide">{t("question.title")}</DialogTitle>
          <DialogDescription>{t("question.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6">
          <blockquote className="max-h-28 overflow-y-auto rounded-r-lg border-l-2 border-primary/50 bg-muted/20 py-2 pl-3.5 pr-3 font-serif text-sm leading-6 text-foreground/90">
            {pending.selection.quote}
          </blockquote>
          <p className="text-[10px] tracking-wide text-muted-foreground">{locationLabel(pending.selection.anchor, locale)}</p>
          <textarea
            ref={textareaRef}
            value={question}
            rows={5}
            placeholder={t("question.placeholder")}
            aria-label={t("question.inputLabel")}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full resize-none border border-input bg-background px-3.5 py-3 font-serif text-sm leading-7 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
          {!modelAvailable ? <p className="text-xs text-destructive">{t("ai.modelRequired")}</p> : null}
        </div>

        <DialogFooter className="border-t border-border/50 px-6 py-3">
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
