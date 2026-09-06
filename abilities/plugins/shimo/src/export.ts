import type { PluginFsApi } from "@vetta-org/plugin-sdk";
import { Value } from "@sinclair/typebox/value";
import { PDFDocument, rgb } from "pdf-lib";
import { ExportDocumentSchema, type ExportDocument, type MaterialManifest, type ReadingPreferences, type ReadingRecord } from "./domain";

type ExportLocale = "zh" | "en";

export function sanitizeExportBaseName(title: string, fallback: string): string {
  const cleaned = title.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-").replace(/[. ]+$/u, "").trim();
  const value = cleaned || fallback;
  return Array.from(value).slice(0, 120).join("");
}

export function buildExportDocument(
  material: MaterialManifest,
  preferences: ReadingPreferences,
  records: ReadingRecord[]
): ExportDocument {
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), material, preferences, records };
}

export function toMarkdown(document: ExportDocument, locale: ExportLocale = "en"): string {
  assertExportDocument(document);
  const lines = [`# ${document.material.title}`, "", `${locale === "zh" ? "导出时间" : "Exported"}: ${document.exportedAt}`, ""];
  for (const record of document.records) {
    const location = exportLocation(record, locale);
    lines.push(`## ${label(record.kind, locale)} · ${location}`, "", `> ${record.quote.replace(/\n/gu, "\n> ")}`, "");
    if (record.body) lines.push(record.body, "");
  }
  return lines.join("\n");
}

export function toHtml(document: ExportDocument, locale: ExportLocale = "en"): string {
  assertExportDocument(document);
  const sections = document.records.map((record) => {
    const location = exportLocation(record, locale);
    return `<section><h2>${escapeHtml(label(record.kind, locale))} · ${escapeHtml(location)}</h2><blockquote>${escapeHtml(record.quote)}</blockquote>${record.body ? `<p>${escapeHtml(record.body)}</p>` : ""}</section>`;
  }).join("\n");
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${escapeHtml(document.material.title)}</title><style>body{max-width:760px;margin:3rem auto;padding:0 1rem;font:16px/1.7 system-ui;color:#24221f}blockquote{border-left:3px solid #b08d57;margin-left:0;padding-left:1rem;color:#555}section{margin:2.5rem 0}</style></head><body><h1>${escapeHtml(document.material.title)}</h1>${sections}</body></html>`;
}

export async function exportRecords(
  fs: PluginFsApi,
  document: ExportDocument,
  format: "json" | "markdown" | "html",
  locale: "zh" | "en"
): Promise<string | null> {
  assertExportDocument(document);
  const base = sanitizeExportBaseName(document.material.title, locale === "zh" ? "阅读记录" : "Reading Notes");
  const suffix = locale === "zh" ? "阅读记录" : "Reading-Notes";
  const extension = format === "markdown" ? "md" : format;
  const content = format === "json" ? JSON.stringify(document, null, 2) : format === "markdown" ? toMarkdown(document, locale) : toHtml(document, locale);
  return fs.saveAs(`${base}-${suffix}.${extension}`, content, "utf8", {
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
  });
}

export async function buildAnnotatedPdf(source: ArrayBuffer, records: ReadingRecord[]): Promise<string> {
  const document = await PDFDocument.load(source.slice(0));
  const pages = document.getPages();
  for (const record of records) {
    if (record.anchor.type !== "pdf" || (record.kind !== "highlight" && record.kind !== "note" && record.kind !== "reflection")) continue;
    const page = pages[record.anchor.page - 1];
    if (!page) continue;
    const { width, height } = page.getSize();
    for (const rect of record.anchor.rects) {
      page.drawRectangle({
        x: rect.x * width,
        y: height - (rect.y + rect.height) * height,
        width: rect.width * width,
        height: rect.height * height,
        color: rgb(1, 0.84, 0.32),
        opacity: 0.28,
        borderWidth: 0
      });
    }
  }
  const bytes = await document.save();
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function label(kind: ReadingRecord["kind"], locale: ExportLocale): string {
  const labels = locale === "zh"
    ? { highlight: "摘录", note: "笔记", reflection: "感想", question: "问题", answer: "AI 回答", pinyin: "拼音" }
    : { highlight: "Highlight", note: "Note", reflection: "Reflection", question: "Question", answer: "AI Answer", pinyin: "Pinyin" };
  return labels[kind];
}

function exportLocation(record: ReadingRecord, locale: ExportLocale): string {
  if (record.anchor.type === "pdf") return locale === "zh" ? `第 ${record.anchor.page} 页` : `Page ${record.anchor.page}`;
  return locale === "zh" ? `位置 ${record.anchor.start}` : `Offset ${record.anchor.start}`;
}

function assertExportDocument(document: ExportDocument): void {
  if (!Value.Check(ExportDocumentSchema, document)) throw new Error("Invalid Shimo export document");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
