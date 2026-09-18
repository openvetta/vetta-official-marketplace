import type {
  Disposable,
  PluginMediaProviderArtifact,
  PluginMediaProviderHandlerContext,
  PluginMediaProviderJob,
  PluginMediaProviderRegistration,
  PluginMediaProviderSubmitRequest,
} from "@vetta-org/plugin-sdk";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";
import { API_CREDENTIAL, createProxyClient, record, textField, type ImageModelRoute } from "./proxy-client";

export const IMAGE_PROVIDER_ID = "images";
const IMAGE_TIMEOUT_MS = 300_000;

type ImageData = { b64_json?: string; url?: string; mimeType?: string };
type ImageGenerationModelDescriptor = {
  id: string;
  displayName?: string;
  sourceId?: string;
  sourceDisplayName?: string;
  modes: readonly ("text-to-image" | "image-to-image")[];
};
type ScopedMediaProviderHandlerContext = PluginMediaProviderHandlerContext & {
  readInput(inputId: string): Promise<{ mimeType: string; data: Uint8Array }>;
};
type ImageProviderRegistration = Omit<PluginMediaProviderRegistration, "capabilities" | "submit"> & {
  capabilities: readonly [{
    operation: "generate";
    kind: "image";
    modes: readonly ("text-to-image" | "image-to-image")[];
    models: readonly ImageGenerationModelDescriptor[];
    defaultModelId?: string;
  }];
  submit(
    request: PluginMediaProviderSubmitRequest,
    context: ScopedMediaProviderHandlerContext,
  ): Promise<PluginMediaProviderJob>;
};

function errorMessage(value: unknown, fallback: string): string {
  const entry = record(value);
  const nested = record(entry?.error);
  return textField(nested, "message") ?? textField(entry, "message", "error") ?? fallback;
}

function errorCode(status: number, message: string): "unauthenticated" | "invalid-request" | "quota-exhausted" | "content-rejected" | "provider-failed" {
  if (status === 401 || status === 403) return "unauthenticated";
  if (status === 429) return "quota-exhausted";
  if (/safety|content|policy|blocked|moderation/iu.test(message)) return "content-rejected";
  return status >= 500 ? "provider-failed" : "invalid-request";
}

function failed(id: string, message: string, code: "unauthenticated" | "invalid-request" | "quota-exhausted" | "content-rejected" | "provider-failed" | "provider-timeout"): PluginMediaProviderJob {
  return { id, status: "failed", error: { code, message, retryable: code === "provider-timeout" || code === "provider-failed" } };
}

function sizeFor(width: number | undefined, height: number | undefined): string {
  if (width === undefined || height === undefined) return "1024x1024";
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be positive integers");
  }
  return `${width}x${height}`;
}

function mimeFromBase64(data: string, fallback = "image/png"): string {
  try {
    const bytes = atob(data.slice(0, 24));
    const codes = [...bytes].map((character) => character.charCodeAt(0));
    if (codes[0] === 0xff && codes[1] === 0xd8) return "image/jpeg";
    if (bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP") return "image/webp";
    if (codes[0] === 0x89 && bytes.slice(1, 4) === "PNG") return "image/png";
  } catch {
    // Provider-declared MIME remains the best evidence for malformed prefixes.
  }
  return fallback;
}

function extensionFor(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function openAiImages(value: unknown): ImageData[] {
  const data = record(value)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const entry = record(item);
    if (!entry) return [];
    const b64 = textField(entry, "b64_json");
    const url = textField(entry, "url");
    return b64 || url ? [{ ...(b64 ? { b64_json: b64 } : {}), ...(url ? { url } : {}) }] : [];
  });
}

function googleImages(value: unknown): ImageData[] {
  const candidates = record(value)?.candidates;
  if (!Array.isArray(candidates)) return [];
  const images: ImageData[] = [];
  for (const candidate of candidates) {
    const parts = record(record(candidate)?.content)?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const inline = record(record(part)?.inlineData) ?? record(record(part)?.inline_data);
      const data = textField(inline, "data");
      if (data) images.push({ b64_json: data, mimeType: textField(inline, "mimeType", "mime_type") });
    }
  }
  return images;
}

async function artifactsFromImages(context: ManagedPluginContext, images: ImageData[]): Promise<PluginMediaProviderArtifact[]> {
  const artifacts: PluginMediaProviderArtifact[] = [];
  for (const [index, image] of images.entries()) {
    if (image.b64_json) {
      const mimeType = image.mimeType ?? mimeFromBase64(image.b64_json);
      const blob = await context.storage.putBlob({
        id: `generated-${crypto.randomUUID()}-${index}`,
        data: image.b64_json,
        mimeType,
      });
      artifacts.push({
        kind: "image",
        mimeType,
        name: `generated-${index + 1}.${extensionFor(mimeType)}`,
        source: { type: "plugin-blob", blobId: blob.id },
      });
    } else if (image.url) {
      artifacts.push({ kind: "image", name: `generated-${index + 1}`, source: { type: "remote-url", url: image.url } });
    }
  }
  return artifacts;
}

function bytesToBase64(data: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function routeFor(models: readonly ImageModelRoute[], modelId: string | undefined): ImageModelRoute | undefined {
  if (!modelId) return undefined;
  return models.find((model) => `${model.sourceId}/${model.id}` === modelId);
}

async function submitOpenAiImage(
  context: ManagedPluginContext,
  route: ImageModelRoute,
  request: Extract<PluginMediaProviderSubmitRequest, { operation: "generate" }>,
  handlerContext: PluginMediaProviderHandlerContext,
  jobId: string,
): Promise<PluginMediaProviderJob> {
  const connection = await context.services.connection("proxy", API_CREDENTIAL);
  if (!connection.credential) return failed(jobId, "The managed API credential is unavailable", "unauthenticated");
  const fields = { model: route.id, prompt: request.prompt, n: "1", size: sizeFor(request.dimensions?.width, request.dimensions?.height), response_format: "b64_json" };
  let response: { ok: boolean; status: number; statusText: string; body: unknown };
  if (request.mode === "image-to-image") {
    const input = request.inputs.find((item) => item.kind === "image");
    if (!input) return failed(jobId, "Image editing requires an input image", "invalid-request");
    response = await handlerContext.uploadInput(input.id, {
      url: `${connection.baseUrl}/v1/images/edits`,
      fieldName: "image",
      fields,
      headers: { Authorization: `Bearer ${connection.credential}` },
      timeoutMs: IMAGE_TIMEOUT_MS,
    });
  } else {
    response = await context.services.request<unknown>("proxy", {
      path: "/v1/images/generations",
      method: "POST",
      credentialId: API_CREDENTIAL,
      body: fields,
      responseType: "json",
      timeoutMs: IMAGE_TIMEOUT_MS,
    });
  }
  if (!response.ok) {
    const message = errorMessage(response.body, `${response.status} ${response.statusText}`);
    return failed(jobId, message, errorCode(response.status, message));
  }
  const images = openAiImages(response.body);
  if (images.length === 0) return failed(jobId, "CPA returned no image data", "provider-failed");
  return { id: jobId, status: "succeeded", artifacts: await artifactsFromImages(context, images) };
}

async function submitGoogleImage(
  context: ManagedPluginContext,
  route: ImageModelRoute,
  request: Extract<PluginMediaProviderSubmitRequest, { operation: "generate" }>,
  handlerContext: ScopedMediaProviderHandlerContext,
  jobId: string,
): Promise<PluginMediaProviderJob> {
  const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
  if (request.mode === "image-to-image") {
    const input = request.inputs.find((item) => item.kind === "image");
    if (!input) return failed(jobId, "Image editing requires an input image", "invalid-request");
    const source = await handlerContext.readInput(input.id);
    parts.push({ inlineData: { mimeType: source.mimeType, data: bytesToBase64(source.data) } });
  }
  const response = await context.services.request<unknown>("proxy", {
    path: `/v1beta/models/${encodeURIComponent(route.id)}:generateContent`,
    method: "POST",
    credentialId: API_CREDENTIAL,
    body: {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        ...(request.aspectRatio ? { imageConfig: { aspectRatio: request.aspectRatio } } : {}),
      },
    },
    responseType: "json",
    timeoutMs: IMAGE_TIMEOUT_MS,
  });
  if (!response.ok) {
    const message = errorMessage(response.body, `${response.status} ${response.statusText}`);
    return failed(jobId, message, errorCode(response.status, message));
  }
  const images = googleImages(response.body);
  if (images.length === 0) return failed(jobId, "CPA returned no image data", "provider-failed");
  return { id: jobId, status: "succeeded", artifacts: await artifactsFromImages(context, images) };
}

export function createImageProviderRegistration(
  context: ManagedPluginContext,
  models: readonly ImageModelRoute[],
): ImageProviderRegistration {
  const descriptors: ImageGenerationModelDescriptor[] = models.map((model) => ({
    id: `${model.sourceId}/${model.id}`,
    ...(model.displayName ? { displayName: model.displayName } : {}),
    sourceId: model.sourceId,
    sourceDisplayName: model.sourceDisplayName,
    modes: model.modes,
  }));
  const preferred = descriptors.find((model) => model.id === "codex/gpt-image-2") ?? descriptors[0];
  return {
    id: IMAGE_PROVIDER_ID,
    displayName: "CLIProxyAPI Images",
    capabilities: [{
      operation: "generate",
      kind: "image",
      modes: [...new Set(descriptors.flatMap((model) => model.modes))],
      models: descriptors,
      ...(preferred ? { defaultModelId: preferred.id } : {}),
    }],
    async submit(request, handlerContext) {
      const jobId = crypto.randomUUID();
      if (request.operation !== "generate" || request.kind !== "image") return failed(jobId, "Only image generation is supported", "invalid-request");
      if (!request.prompt.trim()) return failed(jobId, "An image prompt is required", "invalid-request");
      const route = routeFor(models, request.modelId);
      if (!route) return failed(jobId, `The selected CPA image model is unavailable: ${request.modelId ?? "default"}`, "invalid-request");
      if (!route.modes.includes(request.mode as "text-to-image" | "image-to-image")) {
        return failed(jobId, `The selected model does not support ${request.mode}: ${request.modelId}`, "invalid-request");
      }
      try {
        return route.adapter === "google-generate-content"
          ? await submitGoogleImage(context, route, request, handlerContext, jobId)
          : await submitOpenAiImage(context, route, request, handlerContext, jobId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return failed(jobId, message, /timeout|timed out|aborted/iu.test(message) ? "provider-timeout" : "provider-failed");
      }
    },
  };
}

let refreshCurrentProvider: (() => void) | undefined;

export function refreshImageProviderCatalog(): void {
  refreshCurrentProvider?.();
}

export function registerImageProvider(context: ManagedPluginContext): Disposable {
  const client = createProxyClient(context);
  let provider: Disposable | undefined;
  let signature = "";
  let lastError = "";
  let generation = 0;
  let disposed = false;
  let phase: ServiceStatus["phase"] | undefined;

  const refresh = (): void => {
    const current = ++generation;
    void client.loadImageModels().then((models) => {
      if (disposed || current !== generation) return;
      const nextSignature = JSON.stringify(models);
      if (nextSignature === signature) return;
      provider?.dispose();
      provider = models.length > 0
        ? context.media.registerProvider(createImageProviderRegistration(context, models) as unknown as PluginMediaProviderRegistration)
        : undefined;
      signature = nextSignature;
      lastError = "";
    }).catch((error: unknown) => {
      if (disposed || current !== generation) return;
      const message = error instanceof Error ? error.message : String(error);
      if (message === lastError) return;
      lastError = message;
      context.ui.notify({
        title: "CLIProxyAPI",
        message: "Unable to refresh the available image models.",
        variant: "error",
        error,
      });
    });
  };
  refreshCurrentProvider = refresh;
  const updateStatus = (next: ServiceStatus): void => {
    if (disposed || next.serviceId !== "proxy" || next.phase === phase) return;
    phase = next.phase;
    // The host also broadcasts ready-phase status for every child log chunk.
    // Refreshing on those events makes catalog requests feed back into logs.
    if (next.phase === "ready") refresh();
    else if (["disabled", "stopped", "failed"].includes(next.phase)) {
      generation += 1;
      provider?.dispose();
      provider = undefined;
      signature = "";
    }
  };
  const status = context.services.onStatusChange(updateStatus);
  void context.services.getStatus("proxy").then((current) => {
    if (phase === undefined) updateStatus(current);
  });

  return {
    dispose() {
      disposed = true;
      generation += 1;
      if (refreshCurrentProvider === refresh) refreshCurrentProvider = undefined;
      status.dispose();
      provider?.dispose();
    },
  };
}
