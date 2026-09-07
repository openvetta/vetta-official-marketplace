import { describe, expect, it } from "vitest";
import type { PluginStorageApi } from "@vetta-org/plugin-sdk";
import type { OcrPageCache } from "./domain";
import { ShimoRepository } from "./repository";

function memoryStorage(): PluginStorageApi {
  const files = new Map<string, string>();
  const blobs = new Map<string, { id: string; url: string; mimeType: string }>();
  let revision = 0;
  return {
    list: async (prefix = "") => [...files.keys()].filter((path) => path.startsWith(prefix)),
    readFile: async (path) => files.get(path) ?? null,
    writeFile: async (path, data) => { files.set(path, data); revision += 1; return { revision: String(revision), changedPaths: [path] }; },
    commit: async (changes) => { for (const change of changes) change.type === "remove" ? files.delete(change.path) : files.set(change.path, change.data); revision += 1; return { revision: String(revision), changedPaths: changes.map((change) => change.path) }; },
    readSnapshot: async (paths) => ({ revision: String(revision), files: Object.fromEntries(paths.map((path) => [path, files.get(path) ?? null])) }),
    putBlob: async ({ id, mimeType }) => { const ref = { id: id ?? crypto.randomUUID(), url: "blob:test", mimeType }; blobs.set(ref.id, ref); return ref; },
    putBlobFromFile: async ({ id, mimeType }) => { const ref = { id: id ?? crypto.randomUUID(), url: "blob:test", mimeType }; blobs.set(ref.id, ref); return ref; },
    readBlob: async () => null,
    getBlobRef: async (id) => blobs.get(id) ?? null,
    deleteBlob: async (id) => { blobs.delete(id); },
  } as PluginStorageApi;
}

describe("ShimoRepository", () => {
  it("copies supported files, commits a manifest, and stores OCR pages separately", async () => {
    const storage = memoryStorage();
    const repository = new ShimoRepository(storage);
    const manifest = await repository.importFile(new File(["hello"], "book.txt", { type: "text/plain" }));
    expect((await repository.listMaterials())[0]?.sourceBlobId).toBe(manifest.sourceBlobId);
    expect((await repository.getManifest(manifest.id))?.classification?.source).toBe("heuristic");
    await storage.writeFile("library/catalog.json", JSON.stringify({
      schemaVersion: 1,
      entries: [manifest, { id: "broken", kind: "not-a-format" }]
    }), "utf8");
    expect((await repository.listMaterials()).map((entry) => entry.id)).toEqual([manifest.id]);
    await repository.writeOcrPage(manifest.id, { schemaVersion: 1, page: 1, text: "识别文本", providerId: "desktop-app:ppocrv5", createdAt: new Date().toISOString() });
    expect((await repository.readOcrPage(manifest.id, 1))?.text).toBe("识别文本");
  });

  it("rejects unsupported source formats before writing", async () => {
    const repository = new ShimoRepository(memoryStorage());
    await expect(repository.importFile(new File(["x"], "book.epub"))).rejects.toThrow("Only PDF");
  });

  it("rejects malformed nested data at the storage boundary", async () => {
    const storage = memoryStorage();
    const repository = new ShimoRepository(storage);
    await storage.writeFile("records/material/bad.json", JSON.stringify({
      schemaVersion: 1,
      id: "bad",
      materialId: "material",
      kind: "answer",
      quote: "quote",
      anchor: { type: "pdf", page: 0, quote: "quote", rects: [] },
      createdAt: "now",
      updatedAt: "now",
      revision: 1
    }), "utf8");

    expect(await repository.listRecords("material")).toEqual([]);

    const invalidCache = {
      schemaVersion: 1,
      page: 1,
      text: "text",
      providerId: "provider",
      createdAt: "now",
      blocks: [{ text: "text", confidence: 2 }]
    } as unknown as OcrPageCache;
    await expect(repository.writeOcrPage("material", invalidCache)).rejects.toThrow("Invalid OCR page cache");
  });
});
