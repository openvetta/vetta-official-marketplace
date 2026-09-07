import type { PluginStorageApi } from "@vetta-org/plugin-sdk";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  AiSettingsSchema,
  DEFAULT_AI_SETTINGS,
  DEFAULT_PREFERENCES,
  LibraryEntrySchema,
  MaterialManifestSchema,
  OcrPageCacheSchema,
  PinyinTokensSchema,
  ReadingPreferencesSchema,
  ReadingRecordSchema,
  type AiSettings,
  type DocumentKind,
  type LibraryCatalog,
  type LibraryEntry,
  type MaterialManifest,
  type OcrPageCache,
  type ReadingPreferences,
  type ReadingRecord
} from "./domain";
import { inferCategory } from "./classification";

const CATALOG_PATH = "library/catalog.json";
const AI_SETTINGS_PATH = "settings/ai.json";
const EMPTY_CATALOG: LibraryCatalog = { schemaVersion: 1, entries: [] };

export class ShimoRepository {
  constructor(private readonly storage: PluginStorageApi) {}

  async listMaterials(): Promise<LibraryEntry[]> {
    return (await this.readCatalog()).entries.filter((entry) => entry.status === "active");
  }

  async getManifest(materialId: string): Promise<MaterialManifest | null> {
    return this.readJson(`library/materials/${safeId(materialId)}/manifest.json`, isManifest);
  }

  async importFile(file: File): Promise<MaterialManifest> {
    const kind = kindForName(file.name);
    if (!kind) throw new Error("Only PDF, Markdown, and TXT files are supported");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const sourceBlobId = `source-${id}`;
    const title = file.name.replace(/\.[^.]+$/u, "").trim() || file.name;
    const mimeType = file.type || mimeForKind(kind);
    const blob = await this.storage.putBlobFromFile({ id: sourceBlobId, file, mimeType });
    const manifest: MaterialManifest = {
      schemaVersion: 1,
      id,
      title,
      kind,
      category: inferCategory(kind, title),
      sourceName: file.name,
      sourceBlobId: blob.id,
      mimeType,
      sizeBytes: file.size,
      createdAt: now,
      updatedAt: now,
      status: "active",
      classification: { source: "heuristic", updatedAt: now }
    };
    try {
      await this.commitImportedManifest(manifest);
      return manifest;
    } catch (error) {
      await deleteBlobIfSupported(this.storage, blob.id);
      throw error;
    }
  }

  async updateManifest(manifest: MaterialManifest): Promise<void> {
    assertSchema(MaterialManifestSchema, manifest, "material manifest");
    const snapshot = await this.storage.readSnapshot([CATALOG_PATH], "utf8");
    const catalog = parseCatalog(snapshot.files[CATALOG_PATH]);
    const entries = catalog.entries.map((entry) => entry.id === manifest.id ? toLibraryEntry(manifest) : entry);
    await this.storage.commit([
      jsonWrite(`library/materials/${safeId(manifest.id)}/manifest.json`, manifest),
      jsonWrite(CATALOG_PATH, { schemaVersion: 1, entries })
    ], { expectedRevision: snapshot.revision });
  }

  async trashMaterial(materialId: string): Promise<void> {
    const manifest = await this.getManifest(materialId);
    if (!manifest) return;
    await this.updateManifest({ ...manifest, status: "trashed", updatedAt: new Date().toISOString() });
  }

  async getSourceUrl(materialId: string): Promise<string> {
    const manifest = await this.getManifest(materialId);
    if (!manifest) throw new Error("Material not found");
    const ref = await this.storage.getBlobRef(manifest.sourceBlobId);
    if (!ref) throw new Error("Material source copy is unavailable");
    return ref.url;
  }

  async readSourceText(materialId: string): Promise<string> {
    const url = await this.getSourceUrl(materialId);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to read material (${response.status})`);
    return response.text();
  }

  async listRecords(materialId: string): Promise<ReadingRecord[]> {
    const prefix = `records/${safeId(materialId)}`;
    const paths = (await this.storage.list(prefix)).filter((path) => path.endsWith(".json"));
    if (paths.length === 0) return [];
    const snapshot = await this.storage.readSnapshot(paths, "utf8");
    return paths
      .flatMap((path) => {
        const value = parseJson(snapshot.files[path]);
        return isRecord(value) ? [value] : [];
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveRecord(record: ReadingRecord): Promise<void> {
    assertSchema(ReadingRecordSchema, record, "reading record");
    await this.storage.writeFile(recordPath(record.materialId, record.id), JSON.stringify(record, null, 2), "utf8");
  }

  async updateRecord(record: ReadingRecord): Promise<ReadingRecord> {
    const current = await this.readJson(recordPath(record.materialId, record.id), isRecord);
    if (current && current.revision !== record.revision) throw new Error("Reading record was changed in another view");
    const next = { ...record, revision: record.revision + 1, updatedAt: new Date().toISOString() };
    await this.saveRecord(next);
    return next;
  }

  async getPreferences(materialId: string): Promise<ReadingPreferences> {
    return (await this.readJson(`preferences/${safeId(materialId)}.json`, isPreferences)) ?? DEFAULT_PREFERENCES;
  }

  async savePreferences(materialId: string, preferences: ReadingPreferences): Promise<void> {
    assertSchema(ReadingPreferencesSchema, preferences, "reading preferences");
    await this.storage.writeFile(
      `preferences/${safeId(materialId)}.json`,
      JSON.stringify(preferences, null, 2),
      "utf8"
    );
  }

  async getAiSettings(): Promise<AiSettings> {
    return (await this.readJson(AI_SETTINGS_PATH, isAiSettings)) ?? DEFAULT_AI_SETTINGS;
  }

  async saveAiSettings(settings: AiSettings): Promise<void> {
    assertSchema(AiSettingsSchema, settings, "AI settings");
    await this.storage.writeFile(AI_SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
  }

  async readPinyinCache(key: string): Promise<Array<{ text: string; pinyin: string }> | null> {
    const value = await this.readJson(`cache/pinyin/${safeId(key)}.json`, isPinyinTokens);
    return value;
  }

  async writePinyinCache(key: string, value: Array<{ text: string; pinyin: string }>): Promise<void> {
    assertSchema(PinyinTokensSchema, value, "pinyin cache");
    await this.storage.writeFile(`cache/pinyin/${safeId(key)}.json`, JSON.stringify(value), "utf8");
  }

  async readOcrPage(materialId: string, page: number): Promise<OcrPageCache | null> {
    return this.readJson(`derived/${safeId(materialId)}/ocr/page-${safePage(page)}.json`, isOcrPageCache);
  }

  async writeOcrPage(materialId: string, value: OcrPageCache): Promise<void> {
    assertSchema(OcrPageCacheSchema, value, "OCR page cache");
    await this.storage.writeFile(
      `derived/${safeId(materialId)}/ocr/page-${safePage(value.page)}.json`,
      JSON.stringify(value, null, 2),
      "utf8"
    );
  }

  private async commitImportedManifest(manifest: MaterialManifest): Promise<void> {
    assertSchema(MaterialManifestSchema, manifest, "material manifest");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await this.storage.readSnapshot([CATALOG_PATH], "utf8");
      const catalog = parseCatalog(snapshot.files[CATALOG_PATH]);
      try {
        await this.storage.commit([
          jsonWrite(`library/materials/${safeId(manifest.id)}/manifest.json`, manifest),
          jsonWrite(CATALOG_PATH, { schemaVersion: 1, entries: [toLibraryEntry(manifest), ...catalog.entries] })
        ], { expectedRevision: snapshot.revision });
        return;
      } catch (error) {
        if (attempt === 2 || !String(error).toLowerCase().includes("conflict")) throw error;
      }
    }
  }

  private async readCatalog(): Promise<LibraryCatalog> {
    return parseCatalog(await this.storage.readFile(CATALOG_PATH, "utf8"));
  }

  private async readJson<T>(path: string, guard: (value: unknown) => value is T): Promise<T | null> {
    const value = parseJson(await this.storage.readFile(path, "utf8"));
    return guard(value) ? value : null;
  }
}

export function createRecord(
  materialId: string,
  kind: ReadingRecord["kind"],
  quote: string,
  anchor: ReadingRecord["anchor"],
  extras: Partial<ReadingRecord> = {}
): ReadingRecord {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    materialId,
    kind,
    quote,
    anchor,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    ...extras
  };
}

function recordPath(materialId: string, recordId: string): string {
  return `records/${safeId(materialId)}/${safeId(recordId)}.json`;
}

function jsonWrite(path: string, value: unknown) {
  return { type: "write" as const, path, data: JSON.stringify(value, null, 2), encoding: "utf8" as const };
}

function parseCatalog(raw: string | null | undefined): LibraryCatalog {
  const value = parseJson(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_CATALOG;
  const object = value as Record<string, unknown>;
  return object.schemaVersion === 1 && Array.isArray(object.entries)
    ? { schemaVersion: 1, entries: object.entries.flatMap((entry) => {
        if (isManifest(entry)) return [toLibraryEntry(entry)];
        return isLibraryEntry(entry) ? [entry] : [];
      }) }
    : EMPTY_CATALOG;
}

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function isLibraryEntry(value: unknown): value is LibraryEntry {
  return Value.Check(LibraryEntrySchema, value);
}

function isManifest(value: unknown): value is MaterialManifest {
  return Value.Check(MaterialManifestSchema, value);
}

function isRecord(value: unknown): value is ReadingRecord {
  return Value.Check(ReadingRecordSchema, value);
}

function isPreferences(value: unknown): value is ReadingPreferences {
  return Value.Check(ReadingPreferencesSchema, value);
}

function isAiSettings(value: unknown): value is AiSettings {
  return Value.Check(AiSettingsSchema, value);
}

function isPinyinTokens(value: unknown): value is Array<{ text: string; pinyin: string }> {
  return Value.Check(PinyinTokensSchema, value);
}

function isOcrPageCache(value: unknown): value is OcrPageCache {
  return Value.Check(OcrPageCacheSchema, value);
}

function toLibraryEntry(manifest: MaterialManifest): LibraryEntry {
  const { schemaVersion: _schemaVersion, contentSha256: _contentSha256, language: _language, pageCount: _pageCount, classification: _classification, ...entry } = manifest;
  return entry;
}

function assertSchema(schema: TSchema, value: unknown, label: string): void {
  if (!Value.Check(schema, value)) throw new Error(`Invalid ${label}`);
}

function kindForName(name: string): DocumentKind | null {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "pdf" ? "pdf" : extension === "md" || extension === "markdown" ? "markdown" : extension === "txt" ? "text" : null;
}

function mimeForKind(kind: DocumentKind): string {
  return kind === "pdf" ? "application/pdf" : kind === "markdown" ? "text/markdown" : "text/plain";
}

function safeId(value: string): string {
  if (!/^[a-zA-Z0-9._-]+$/u.test(value)) throw new Error("Invalid Shimo record id");
  return value;
}

function safePage(value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new Error("Invalid PDF page number");
  return value;
}

async function deleteBlobIfSupported(storage: PluginStorageApi, id: string): Promise<void> {
  const extended = storage as PluginStorageApi & { deleteBlob?: (blobId: string) => Promise<void> };
  await extended.deleteBlob?.(id).catch(() => undefined);
}
