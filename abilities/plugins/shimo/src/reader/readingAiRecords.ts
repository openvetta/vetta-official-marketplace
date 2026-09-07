import type { PluginAiApi } from "@vetta-org/plugin-sdk";
import { completeReading } from "../ai";
import type { MaterialManifest, ReadingRecord } from "../domain";
import { createRecord, type ShimoRepository } from "../repository";
import type { SelectionAction } from "../classification";
import { buildReadingSystemPrompt } from "./prompts";
import type { Locale, ReadingSelection } from "./types";

export interface AnswerReadingSelectionInput {
  ai: PluginAiApi;
  repository: ShimoRepository;
  modelKey: string;
  manifest: MaterialManifest;
  selection: ReadingSelection;
  action: SelectionAction;
  question: string;
  prompt: string;
  locale: Locale;
  signal?: AbortSignal;
  onQuestionSaved?(question: ReadingRecord): void;
  onAnswerChanged?(answer: ReadingRecord): void;
}

export async function answerReadingSelection(input: AnswerReadingSelectionInput): Promise<{
  question: ReadingRecord;
  answer: ReadingRecord;
}> {
  const question = createRecord(input.manifest.id, "question", input.selection.quote, input.selection.anchor, {
    actionId: input.action.id,
    body: input.question.trim(),
  });
  await input.repository.saveRecord(question);
  input.onQuestionSaved?.(question);

  const answerDraft = createRecord(input.manifest.id, "answer", input.selection.quote, input.selection.anchor, {
    actionId: input.action.id,
    body: "",
    modelKey: input.modelKey,
    relatedRecordId: question.id,
  });
  input.onAnswerChanged?.(answerDraft);

  const result = await completeReading(
    input.ai,
    input.modelKey,
    buildReadingSystemPrompt(input.manifest.category, input.locale),
    input.prompt,
    {
      signal: input.signal,
      onTextDelta: ({ text }) => input.onAnswerChanged?.({ ...answerDraft, body: text, updatedAt: new Date().toISOString() })
    },
  );
  const answer = { ...answerDraft, body: result.text, updatedAt: new Date().toISOString() };
  await input.repository.saveRecord(answer);
  input.onAnswerChanged?.(answer);
  return { question, answer };
}
