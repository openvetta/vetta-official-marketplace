import { describe, expect, it } from "vitest";
import { buildExportDocument, sanitizeExportBaseName, toHtml, toMarkdown } from "./export";
import type { MaterialManifest } from "./domain";

const material: MaterialManifest = {
  schemaVersion: 1, id: "m1", title: "A/B: Notes?", kind: "text", category: "book", sourceName: "notes.txt", sourceBlobId: "b1", mimeType: "text/plain", sizeBytes: 3, createdAt: "2026-01-01", updatedAt: "2026-01-01", status: "active"
};

describe("Shimo exports", () => {
  it("uses a material-derived safe filename", () => {
    expect(sanitizeExportBaseName(material.title, "Fallback")).toBe("A-B- Notes-");
  });

  it("escapes HTML and preserves quote/location records", () => {
    const document = buildExportDocument(material, { schemaVersion: 1, pinyin: "on-demand", scannedPdfOcr: "never", rememberPosition: true }, [{ schemaVersion: 1, id: "r1", materialId: "m1", kind: "note", quote: "<quoted>", body: "reflection", anchor: { type: "text", start: 0, end: 8, quote: "<quoted>", prefix: "", suffix: "" }, createdAt: "2026-01-01", updatedAt: "2026-01-01", revision: 1 }]);
    expect(toMarkdown(document)).toContain("> <quoted>");
    expect(toHtml(document)).toContain("&lt;quoted&gt;");
    expect(toMarkdown(document, "zh")).toContain("## 笔记 · 位置 0");
    expect(toHtml(document, "zh")).toContain('<html lang="zh">');
  });
});
