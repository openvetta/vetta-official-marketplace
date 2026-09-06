import type { ReadingRecord } from "../domain";

interface HastPosition {
  start: { offset?: number };
  end: { offset?: number };
}

export interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  position?: HastPosition;
}

export function createMarkdownPinyinPlugin(records: ReadingRecord[]): () => (tree: HastNode) => void {
  return () => (tree) => visit(tree, records);
}

function visit(parent: HastNode, records: ReadingRecord[]): void {
  if (!parent.children) return;
  const nextChildren: HastNode[] = [];

  for (const child of parent.children) {
    if (child.type === "text" && typeof child.value === "string") {
      nextChildren.push(...annotateTextNode(child, records));
    } else {
      visit(child, records);
      nextChildren.push(child);
    }
  }
  parent.children = nextChildren;
}

export function annotateTextNode(node: HastNode, records: ReadingRecord[]): HastNode[] {
  const value = node.value;
  const nodeStart = node.position?.start.offset;
  const nodeEnd = node.position?.end.offset;
  if (typeof value !== "string" || nodeStart === undefined || nodeEnd === undefined) return [node];

  const annotations = records.flatMap((record) => {
    if (record.anchor.type !== "text" || !record.pinyin) return [];
    if (record.anchor.start < nodeStart || record.anchor.end > nodeEnd) return [];
    const relativeStart = record.anchor.start - nodeStart;
    const relativeEnd = record.anchor.end - nodeStart;
    if (value.slice(relativeStart, relativeEnd) !== record.quote) return [];
    return [{ record, relativeStart, relativeEnd }];
  }).sort((left, right) => left.relativeStart - right.relativeStart);

  if (annotations.length === 0) return [node];
  const result: HastNode[] = [];
  let cursor = 0;
  for (const annotation of annotations) {
    if (annotation.relativeStart < cursor) continue;
    if (annotation.relativeStart > cursor) {
      result.push({ type: "text", value: value.slice(cursor, annotation.relativeStart) });
    }
    result.push(...annotation.record.pinyin!.map((token) => ({
      type: "element",
      tagName: "ruby",
      properties: { "data-shimo-record": annotation.record.id },
      children: [
        { type: "text", value: token.text },
        { type: "element", tagName: "rt", properties: {}, children: [{ type: "text", value: token.pinyin }] }
      ]
    })));
    cursor = annotation.relativeEnd;
  }
  if (cursor < value.length) result.push({ type: "text", value: value.slice(cursor) });
  return result;
}
