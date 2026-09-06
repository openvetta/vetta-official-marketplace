import type { ReadingRecord } from "../domain";

export class PendingQuestionLedger {
  private questions: ReadingRecord[] = [];

  stage(question: ReadingRecord): void {
    this.questions.push(question);
  }

  next(): ReadingRecord | undefined {
    return this.questions.shift();
  }

  clearMaterial(materialId: string): void {
    this.questions = this.questions.filter((question) => question.materialId !== materialId);
  }

  remove(recordId: string): void {
    this.questions = this.questions.filter((question) => question.id !== recordId);
  }
}
