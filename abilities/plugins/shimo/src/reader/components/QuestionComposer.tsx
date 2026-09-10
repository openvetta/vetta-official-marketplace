import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spin
} from "@vetta/ui";
import { Quote, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import type { Locale, PendingQuestion } from "../types";

interface QuestionComposerProps {
  pending: PendingQuestion;
  locale: Locale;
  t: PluginTranslate;
  modelAvailable: boolean;
  onCancel(): void;
  onSubmit(question: string): Promise<void>;
}

const QUICK_PROMPTS_ZH = [
  "解释这段话的深层含义",
  "总结核心观点与论述",
  "用通俗通晓的话重述"
];

const QUICK_PROMPTS_EN = [
  "Explain the meaning of this passage",
  "Summarize key claim and argument",
  "Explain in simpler terms"
];

export function QuestionComposer({
  pending,
  locale,
  t,
  modelAvailable,
  onCancel,
  onSubmit
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

  const anchor = pending.selection.anchor;
  const quoteLength = pending.selection.quote.trim().length;
  const metaLabel = anchor.type === "pdf"
    ? (locale === "zh" ? `第 ${anchor.page} 页 · ${quoteLength} 字` : `Page ${anchor.page} · ${quoteLength} chars`)
    : (locale === "zh" ? `已选 ${quoteLength} 字` : `${quoteLength} chars`);

  const quickPrompts = locale === "zh" ? QUICK_PROMPTS_ZH : QUICK_PROMPTS_EN;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onCancel(); }}>
      <DialogContent className="overflow-hidden rounded-2xl p-0 sm:max-w-lg shadow-2xl border border-border/60 bg-background/95 backdrop-blur-xl" showCloseButton={false}>
        {/* 顶部标题与关闭按钮 */}
        <DialogHeader className="px-6 pb-2 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                {t("question.title")}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                {t("question.description")}
              </DialogDescription>
            </div>
            <span
              role="button"
              tabIndex={0}
              aria-label={t("common.close")}
              onClick={onCancel}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCancel();
                }
              }}
              className="inline-grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground shrink-0 -mt-1 -mr-1 cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6">
          {/* 原文引用卡片（明确的引用语义） */}
          <div className="rounded-xl border border-border/40 bg-muted/25 p-3 text-xs leading-relaxed">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                <Quote className="h-3 w-3 text-primary/70" />
                <span>{locale === "zh" ? "引用选文" : "Quoted passage"}</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/70">
                {metaLabel}
              </span>
            </div>
            <p className="max-h-24 overflow-y-auto text-muted-foreground text-xs leading-relaxed italic border-l-2 border-primary/30 pl-2.5">
              “{pending.selection.quote}”
            </p>
          </div>

          {/* 快捷提问推荐 Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-0.5">
              <Sparkles className="h-3 w-3 text-primary/70" />
              <span>{locale === "zh" ? "快捷提问:" : "Quick ask:"}</span>
            </span>
            {quickPrompts.map((prompt) => (
              <span
                key={prompt}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setQuestion(prompt);
                  textareaRef.current?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setQuestion(prompt);
                    textareaRef.current?.focus();
                  }
                }}
                className="cursor-pointer rounded-lg border border-border/50 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
              >
                {prompt}
              </span>
            ))}
          </div>

          {/* 提问输入框 */}
          <textarea
            ref={textareaRef}
            value={question}
            rows={4}
            placeholder={t("question.placeholder")}
            aria-label={t("question.inputLabel")}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full resize-none rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20"
          />
          {!modelAvailable ? <p className="text-xs text-destructive">{t("ai.modelRequired")}</p> : null}
        </div>

        {/* 底部操作与快捷键 */}
        <DialogFooter className="border-t border-border/40 px-6 py-3 bg-muted/10">
          <span className="mr-auto self-center text-[10px] text-muted-foreground/70 font-mono">
            {t("composer.shortcut")}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting} className="rounded-lg text-xs">
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={!question.trim() || !modelAvailable || submitting}
            className="rounded-lg text-xs font-medium"
          >
            {submitting ? (
              <>
                <Spin size="sm" />
                {t("question.answering")}
              </>
            ) : (
              t("question.ask")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
