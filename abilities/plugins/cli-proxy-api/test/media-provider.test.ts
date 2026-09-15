import { describe, expect, it, vi } from "vitest";
import { registerImageProvider } from "../src/media-provider";
import type { ManagedPluginContext } from "../src/runtime-contract";

function fixture(responseBody: unknown) {
  const request = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", body: responseBody }));
  const putBlob = vi.fn(async ({ id }: { id?: string }) => ({ id: id ?? "blob-1", url: "vetta-media://blob-1", mimeType: "image/png" }));
  let registration: any;
  const context = {
    services: {
      connection: vi.fn(async () => ({ baseUrl: "http://127.0.0.1:12345", credential: "api-key" })),
      request,
    },
    storage: { putBlob },
    media: { registerProvider: vi.fn((value) => { registration = value; return { dispose: vi.fn() }; }) },
  } as unknown as ManagedPluginContext;
  registerImageProvider(context);
  return { context, request, putBlob, registration };
}

describe("CLIProxyAPI image provider", () => {
  it("uses the Images generations endpoint and stores base64 output", async () => {
    const f = fixture({ data: [{ b64_json: "aW1hZ2U=" }] });
    const job = await f.registration.submit({ operation: "generate", kind: "image", mode: "text-to-image", prompt: "a red fox" }, {});
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
      inputs: [{ id: "source-1", kind: "image" }],
    }, { uploadInput });
    expect(uploadInput).toHaveBeenCalledWith("source-1", expect.objectContaining({
      url: "http://127.0.0.1:12345/v1/images/edits", fieldName: "image",
      fields: expect.objectContaining({ model: "gpt-image-2", prompt: "make it snowy" }),
    }));
    expect(job.status).toBe("succeeded");
  });

  it("rejects a text model id instead of sending it to the image route", async () => {
    const f = fixture({ data: [] });
    const job = await f.registration.submit({ operation: "generate", kind: "image", mode: "text-to-image", modelId: "gpt-5.5", prompt: "x" }, {});
    expect(job).toMatchObject({ status: "failed", error: { code: "invalid-request" } });
    expect(f.request).not.toHaveBeenCalled();
  });
});
