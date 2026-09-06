import type { ReadingAnchor, ReadingRecord } from "../domain";
import type { SelectionAction } from "../classification";

export type Locale = "zh" | "en";

export interface ReadingSelection {
  quote: string;
  anchor: ReadingAnchor;
  x: number;
  y: number;
}

export interface PendingNote {
  kind: "note" | "reflection";
  action: SelectionAction;
  selection: ReadingSelection;
}

export interface ReaderNotice {
  id: number;
  tone: "info" | "success" | "error";
  message: string;
}

export interface RecordGroup {
  label: string;
  records: ReadingRecord[];
}

export function localeFrom(value: string): Locale {
  return value.startsWith("zh") ? "zh" : "en";
}
