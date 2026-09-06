import { describe, expect, it } from "vitest";
import type { ReadingRecord } from "../domain";
import { PendingQuestionLedger } from "./questionLedger";

function question(id: string, materialId = "material"): ReadingRecord {
  return {
    schemaVersion: 1,
    id,
    materialId,
    kind: "question",
    quote: id,
    anchor: { type: "text", start: 0, end: 1, quote: id, prefix: "", suffix: "" },
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
    revision: 1
  };
}

describe("pending AI question ledger", () => {
  it("pairs queued replies in FIFO order", () => {
    const ledger = new PendingQuestionLedger();
    ledger.stage(question("first"));
    ledger.stage(question("second"));

    expect(ledger.next()?.id).toBe("first");
    expect(ledger.next()?.id).toBe("second");
  });

  it("removes failed questions for one material without touching another", () => {
    const ledger = new PendingQuestionLedger();
    ledger.stage(question("remove", "one"));
    ledger.stage(question("keep", "two"));
    ledger.clearMaterial("one");

    expect(ledger.next()?.id).toBe("keep");
  });

  it("removes only the failed queued question", () => {
    const ledger = new PendingQuestionLedger();
    ledger.stage(question("keep"));
    ledger.stage(question("remove"));
    ledger.remove("remove");

    expect(ledger.next()?.id).toBe("keep");
    expect(ledger.next()).toBeUndefined();
  });
});
