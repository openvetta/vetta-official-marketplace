import type { PluginAiApi, PluginAiCompleteResult, PluginContext, PluginStorageApi } from "@vetta-org/plugin-sdk";
import { ShimoRepository } from "../../repository";
import type { ShimoRuntime } from "../../runtime";

export async function createReaderTestRuntime() {
  const files = new Map<string, string>();
  const blobs = new Map<string, { id: string; url: string; mimeType: string }>();
  let revision = 0;
  const storage: PluginStorageApi = {
    list: async (prefix = "") => [...files.keys()].filter((path) => path.startsWith(prefix)),
    readFile: async (path: string) => files.get(path) ?? null,
    writeFile: async (path: string, data: string) => {
      files.set(path, data);
      return { revision: String(++revision), changedPaths: [path] };
    },
    readSnapshot: async (paths) => ({ revision: String(revision), files: Object.fromEntries(paths.map((path) => [path, files.get(path) ?? null])) }),
    commit: async (changes: Parameters<PluginStorageApi["commit"]>[0]) => {
      for (const change of changes) change.type === "remove" ? files.delete(change.path) : files.set(change.path, change.data);
      return { revision: String(++revision), changedPaths: changes.map((change) => change.path) };
    },
    putBlobFromFile: async ({ id, file, mimeType }: Parameters<PluginStorageApi["putBlobFromFile"]>[0]) => {
      const ref = { id: id ?? crypto.randomUUID(), mimeType, url: `data:text/plain;charset=utf-8,${encodeURIComponent(await file.text())}` };
      blobs.set(ref.id, ref);
      return ref;
    },
    getBlobRef: async (id: string) => blobs.get(id) ?? null,
    putBlob: async () => { throw new Error("Binary writes are outside this reader fixture"); },
    readBlob: async () => { throw new Error("Binary reads are outside this reader fixture"); },
    deleteBlob: async (id) => { blobs.delete(id); },
  };
  const repository = new ShimoRepository(storage);
  const first = await repository.importFile(new File(["Read this passage.\n\nContinue reading here."], "First essay.txt", { type: "text/plain" }));
  const second = await repository.importFile(new File(["Another material."], "Second essay.txt", { type: "text/plain" }));
  for (const manifest of [first, second]) {
    await repository.updateManifest({ ...manifest, category: "article", classification: { source: "ai", updatedAt: manifest.updatedAt } });
  }
  let selectedId: string | null = first.id;
  let streamOptions: Parameters<PluginAiApi["stream"]>[1];
  let finish: ((result: PluginAiCompleteResult) => void) | undefined;
  let fail: ((error: Error) => void) | undefined;
  let started: (() => void) | undefined;
  const answerStarted = new Promise<void>((resolve) => { started = resolve; });
  const ai = {
    listModels: async () => ({
      defaultModel: "provider/reader",
      models: [{ modelKey: "provider/reader", provider: "provider", id: "reader", name: "Reader", api: "openai-responses", reasoning: false, input: ["text"], contextWindow: 128000 }],
    }),
    stream: (_request, options) => new Promise<PluginAiCompleteResult>((resolve, reject) => {
      streamOptions = options;
      finish = resolve;
      fail = reject;
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      started?.();
    }),
  } satisfies Pick<PluginAiApi, "listModels" | "stream">;
  const runtime: ShimoRuntime = {
    context: { ai, storage } as unknown as PluginContext,
    repository,
    getSelectedId: () => selectedId,
    setSelectedId: (id) => { selectedId = id; },
    notifyRecordsChanged: () => undefined,
    subscribe: () => () => undefined,
  };
  return {
    runtime, first, second, answerStarted,
    emitAnswer: (text: string) => streamOptions?.onTextDelta?.({ text, delta: text }),
    finishAnswer: (text: string) => finish?.({ modelKey: "provider/reader", text, stopReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }),
    failAnswer: () => fail?.(new Error("Provider unavailable")),
  };
}
