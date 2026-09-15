import type {
  PluginMediaProviderArtifact,
  PluginMediaProviderHandlerContext,
  PluginMediaProviderJob,
  PluginMediaProviderRegistration,
  PluginMediaProviderSubmitRequest,
} from "@vetta-org/plugin-sdk";
import type { ManagedPluginContext } from "./runtime-contract";
import { API_CREDENTIAL, isImageOnlyModelId, record, textField } from "./proxy-client";

export const IMAGE_PROVIDER_ID = "images";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const IMAGE_TIMEOUT_MS = 300_000;

type ImageData = { b64_json?: string; url?: string; revised_prompt?: string };

function imageData(value: unknown): ImageData[] {
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

function errorMessage(value: unknown, fallback: string): string {
  const entry = record(value);
  const nested = record(entry?.error);
  return textField(nested, "message") ?? textField(entry, "message", "error") ?? fallback;
}

function failed(id: string, message: string, code: "unauthenticated" | "invalid-request" | "provider-failed" | "provider-timeout"): PluginMediaProviderJob {
  return { id, status: "failed", error: { code, message, retryable: code === "provider-timeout" || code === "provider-failed" } };
}

function sizeFor(width: number | undefined, height: number | undefined): string {
  if (width === undefined || height === undefined) return "1024x1024";
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be positive integers");
  }
  return `${width}x${height}`;
}

async function artifactsFromImages(context: ManagedPluginContext, images: ImageData[]): Promise<PluginMediaProviderArtifact[]> {
  const artifacts: PluginMediaProviderArtifact[] = [];
  for (const [index, image] of images.entries()) {
    if (image.b64_json) {
      const blob = await context.storage.putBlob({ id: `generated-${crypto.randomUUID()}-${index}`, data: image.b64_json, mimeType: "image/png" });
      artifacts.push({ kind: "image", mimeType: "image/png", name: `generated-${index + 1}.png`, source: { type: "plugin-blob", blobId: blob.id } });
    } else if (image.url) {
      artifacts.push({ kind: "image", mimeType: "image/png", name: `generated-${index + 1}.png`, source: { type: "remote-url", url: image.url } });
    }
  }
  return artifacts;
}

async function submitImage(
  context: ManagedPluginContext,
  request: PluginMediaProviderSubmitRequest,
  handlerContext: PluginMediaProviderHandlerContext,
): Promise<PluginMediaProviderJob> {
  const jobId = crypto.randomUUID();
  if (request.operation !== "generate" || request.kind !== "image") return failed(jobId, "Only image generation is supported", "invalid-request");
  const model = request.modelId?.trim() || DEFAULT_IMAGE_MODEL;
  if (!isImageOnlyModelId(model)) return failed(jobId, `The CPA image provider only accepts image models, received ${model}`, "invalid-request");
  if (!request.prompt.trim()) return failed(jobId, "An image prompt is required", "invalid-request");

  try {
    const connection = await context.services.connection("proxy", API_CREDENTIAL);
    if (!connection.credential) return failed(jobId, "The managed API credential is unavailable", "unauthenticated");
    const size = sizeFor(request.dimensions?.width, request.dimensions?.height);
    const fields = { model, prompt: request.prompt, n: "1", size, response_format: "b64_json" };
    let body: unknown;
    if (request.mode === "image-to-image") {
      const input = request.inputs?.find((item) => item.kind === "image");
      if (!input) return failed(jobId, "Image editing requires an input image", "invalid-request");
      const response = await handlerContext.uploadInput(input.id ?? "", {
        url: `${connection.baseUrl}/v1/images/edits`,
        fieldName: "image",
        fields,
        headers: { Authorization: `Bearer ${connection.credential}` },
        timeoutMs: IMAGE_TIMEOUT_MS,
      });
      if (!response.ok) return failed(jobId, errorMessage(response.body, `${response.status} ${response.statusText}`), response.status >= 500 ? "provider-failed" : "invalid-request");
      body = response.body;
    } else if (request.mode === "text-to-image") {
      const response = await context.services.request<unknown>("proxy", {
        path: "/v1/images/generations",
        method: "POST",
        credentialId: API_CREDENTIAL,
        body: { ...fields },
        responseType: "json",
        timeoutMs: IMAGE_TIMEOUT_MS,
      });
      if (!response.ok) return failed(jobId, errorMessage(response.body, `${response.status} ${response.statusText}`), response.status >= 500 ? "provider-failed" : "invalid-request");
      body = response.body;
    } else {
      return failed(jobId, `Unsupported image mode: ${request.mode}`, "invalid-request");
    }
    const images = imageData(body);
    if (images.length === 0) return failed(jobId, "CPA returned no image data", "provider-failed");
    return { id: jobId, status: "succeeded", artifacts: await artifactsFromImages(context, images) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failed(jobId, message, /timeout|timed out|aborted/iu.test(message) ? "provider-timeout" : "provider-failed");
  }
}

export function registerImageProvider(context: ManagedPluginContext) {
  const registration: PluginMediaProviderRegistration = {
    id: IMAGE_PROVIDER_ID,
    displayName: "CLIProxyAPI Images",
    capabilities: [{ operation: "generate", kind: "image", modes: ["text-to-image", "image-to-image"] }],
    submit: (request, handlerContext) => submitImage(context, request, handlerContext),
  };
  return context.media.registerProvider(registration);
}
