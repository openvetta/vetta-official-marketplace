import type { ReadingRecord } from "../domain";

export type TextSegment =
  | { type: "plain"; text: string }
  | { type: "pinyin"; recordId: string; tokens: NonNullable<ReadingRecord["pinyin"]> };

export function buildTextSegments(content: string, records: ReadingRecord[]): TextSegment[] {
  const annotations = records
    .flatMap((record) => {
      const tokens = record.pinyin;
      if (record.anchor.type !== "text" || !tokens) return [];
      if (content.slice(record.anchor.start, record.anchor.end) !== record.quote) return [];
      return [{ record, tokens, start: record.anchor.start, end: record.anchor.end }];
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const annotation of annotations) {
    if (annotation.start < cursor) continue;
    if (annotation.start > cursor) {
      segments.push({ type: "plain", text: content.slice(cursor, annotation.start) });
    }
    segments.push({ type: "pinyin", recordId: annotation.record.id, tokens: annotation.tokens });
    cursor = annotation.end;
  }
  if (cursor < content.length) segments.push({ type: "plain", text: content.slice(cursor) });
  return segments;
}
