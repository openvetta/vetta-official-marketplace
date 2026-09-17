import { describe, expect, it, vi } from "vitest";
import { createImageProviderRegistration, registerImageProvider } from "../src/media-provider";
import type { ManagedPluginContext, ServiceStatus } from "../src/runtime-contract";

function fixture(responseBody: unknown) {
  const request = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", body: responseBody }));
  const putBlob = vi.fn(async ({ id }: { id?: string }) => ({ id: id ?? "blob-1", url: "vetta-media://blob-1", mimeType: "image/png" }));
  const context = {
    services: {
      connection: vi.fn(async () => ({ baseUrl: "http://127.0.0.1:12345", credential: "api-key" })),
      request,
    },
    storage: { putBlob },
  } as unknown as ManagedPluginContext;
  const registration = createImageProviderRegistration(context, [
    {
      id: "gpt-image-2",
      sourceId: "codex",
      sourceDisplayName: "OpenAI Codex",
      adapter: "openai-images",
      modes: ["text-to-image", "image-to-image"],
    },
    {
      id: "gemini-3.1-flash-image",
      sourceId: "antigravity",
      sourceDisplayName: "Google Antigravity",
      adapter: "google-generate-content",
      modes: ["text-to-image", "image-to-image"],
    },
  ]);
  return { context, request, putBlob, registration };
}

describe("CLIProxyAPI image provider", () => {
  it("refreshes the catalog on ready transitions, not on child log output", async () => {
    const ready: ServiceStatus = { serviceId: "proxy", phase: "ready", version: "test", installed: true, recentOutput: "" };
    const listeners = new Set<(status: ServiceStatus) => void>();
    const request = vi.fn(async (_serviceId: string, input: { path: string }) => ({
      ok: true, status: 200, statusText: "OK",
      body: input.path === "/v1/models" ? { data: [] } : { models: [] },
    }));
    const context = {
      services: {
        getStatus: vi.fn(async () => ready),
        request,
        onStatusChange: (listener: (status: ServiceStatus) => void) => {
          listeners.add(listener);
          return { dispose: () => { listeners.delete(listener); } };
        },
      },
      media: { registerProvider: vi.fn() },
      ui: { notify: vi.fn() },
    } as unknown as ManagedPluginContext;
    const emit = (status: ServiceStatus) => { for (const listener of listeners) listener(status); };
    const modelReads = () => request.mock.calls.filter(([, input]) => input.path === "/v1/models").length;
    const provider = registerImageProvider(context);
    try {
      await vi.waitFor(() => expect(modelReads()).toBe(1));
      emit({ ...ready, recentOutput: "request log 1" });
      emit({ ...ready, recentOutput: "request log 2" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(modelReads()).toBe(1);

      emit({ ...ready, phase: "stopped" });
      emit(ready);
      await vi.waitFor(() => expect(modelReads()).toBe(2));
    } finally {
      provider.dispose();
    }
  });

  it("uses the Images generations endpoint and stores base64 output", async () => {
    const f = fixture({ data: [{ b64_json: "aW1hZ2U=" }] });
    const job = await f.registration.submit({ operation: "generate", kind: "image", mode: "text-to-image", modelId: "codex/gpt-image-2", prompt: "a red fox" }, { invocationId: "text", readInput: vi.fn(), uploadInput: vi.fn() });
    expect(f.request).toHaveBeenCalledWith("proxy", expect.objectContaining({
      path: "/v1/images/generations", method: "POST", credentialId: "api-key",
      body: expect.objectContaining({ model: "gpt-image-2", response_format: "b64_json" }),
    }));
    expect(f.putBlob).toHaveBeenCalledWith(expect.objectContaining({ data: "aW1hZ2U=", mimeType: "image/png" }));
    expect(job).toMatchObject({ status: "succeeded", artifacts: [{ kind: "image", source: { type: "plugin-blob" } }] });
  });

  it("uploads the source image to the Images edits endpoint", async () => {
    const f = fixture({ data: [{ b64_json: "aW1hZ2U=" }] });
    const uploadInput = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", headers: {}, body: { data: [{ b64_json: "aW1hZ2U=" }] } }));
    const job = await f.registration.submit({
      operation: "generate", kind: "image", mode: "image-to-image", prompt: "make it snowy",
      modelId: "codex/gpt-image-2",
      inputs: [{ id: "source-1", kind: "image" }],
    }, { invocationId: "edit", uploadInput, readInput: vi.fn() });
    expect(uploadInput).toHaveBeenCalledWith("source-1", expect.objectContaining({
      url: "http://127.0.0.1:12345/v1/images/edits", fieldName: "image",
      fields: expect.objectContaining({ model: "gpt-image-2", prompt: "make it snowy" }),
    }));
    expect(job.status).toBe("succeeded");
  });

  it("rejects a text model id instead of sending it to the image route", async () => {
    const f = fixture({ data: [] });
    const job = await f.registration.submit({ operation: "generate", kind: "image", mode: "text-to-image", modelId: "codex/gpt-5.5", prompt: "x" }, { invocationId: "invalid", readInput: vi.fn(), uploadInput: vi.fn() });
    expect(job).toMatchObject({ status: "failed", error: { code: "invalid-request" } });
    expect(f.request).not.toHaveBeenCalled();
  });

  it("uses Gemini generateContent and inlines the current invocation input", async () => {
    const f = fixture({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/webp", data: "UklGRg==" } }] } }] });
    const readInput = vi.fn(async () => ({ mimeType: "image/png", data: new Uint8Array([1, 2, 3]) }));
    const job = await f.registration.submit({
      operation: "generate",
      kind: "image",
      mode: "image-to-image",
      modelId: "antigravity/gemini-3.1-flash-image",
      prompt: "make it snowy",
      inputs: [{ id: "source-1", kind: "image" }],
    }, { invocationId: "google-edit", readInput, uploadInput: vi.fn() });
    expect(readInput).toHaveBeenCalledWith("source-1");
    expect(f.request).toHaveBeenCalledWith("proxy", expect.objectContaining({
      path: "/v1beta/models/gemini-3.1-flash-image:generateContent",
      body: expect.objectContaining({ contents: [expect.objectContaining({ parts: expect.arrayContaining([expect.objectContaining({ inlineData: expect.any(Object) })]) })] }),
    }));
    expect(f.putBlob).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "image/webp" }));
    expect(job.status).toBe("succeeded");
  });
});
