import { useEffect, useRef } from "react";
import type { MaterialManifest, ReadingRecord } from "../domain";
import { createRecord } from "../repository";
import type { ShimoRuntime } from "../runtime";
import { PendingQuestionLedger } from "./questionLedger";
import type { ReadingSelection } from "./types";

interface PendingAsk {
  manifest: MaterialManifest;
  selection: ReadingSelection;
}

interface ConversationRecordBridge {
  stageAsk(manifest: MaterialManifest, selection: ReadingSelection): void;
  clearAsk(): void;
  stageQuestion(question: ReadingRecord): void;
  removeQuestion(recordId: string): void;
}

export function useConversationRecordBridge(
  runtime: ShimoRuntime,
  onRecord: (record: ReadingRecord) => void,
  onError: (error: unknown) => void
): ConversationRecordBridge {
  const pendingQuestions = useRef(new PendingQuestionLedger());
  const pendingAsk = useRef<PendingAsk | null>(null);
  const onRecordRef = useRef(onRecord);
  const onErrorRef = useRef(onError);
  onRecordRef.current = onRecord;
  onErrorRef.current = onError;

  useEffect(() => runtime.context.conversation.on((event) => {
    if (event.type === "message-added" && event.message.role === "user" && pendingAsk.current) {
      const pending = pendingAsk.current;
      pendingAsk.current = null;
      const question = createRecord(
        pending.manifest.id,
        "question",
        pending.selection.quote,
        pending.selection.anchor
      );
      pendingQuestions.current.stage(question);
      void persistProjectedRecord(runtime, question, onRecordRef.current).catch(onErrorRef.current);
      return;
    }

    if (event.type !== "message-added" || event.message.role !== "assistant") return;
    const question = pendingQuestions.current.next();
    if (!question) return;
    const answer = createRecord(question.materialId, "answer", question.quote, question.anchor, {
      body: event.message.text,
      relatedRecordId: question.id,
      actionId: question.actionId
    });
    void persistProjectedRecord(runtime, answer, onRecordRef.current).catch(onErrorRef.current);
  }).dispose, [runtime]);

  return {
    stageAsk: (manifest, selection) => { pendingAsk.current = { manifest, selection }; },
    clearAsk: () => { pendingAsk.current = null; },
    stageQuestion: (question) => { pendingQuestions.current.stage(question); },
    removeQuestion: (recordId) => { pendingQuestions.current.remove(recordId); }
  };
}

async function persistProjectedRecord(
  runtime: ShimoRuntime,
  record: ReadingRecord,
  onRecord: (record: ReadingRecord) => void
): Promise<void> {
  await runtime.repository.saveRecord(record);
  runtime.notifyRecordsChanged(record.materialId);
  onRecord(record);
}
