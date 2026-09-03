import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";
import { SERVICE_ID } from "./proxy-client";
import runtimeLock from "../runtime-lock.json";

type PlatformTag = "win32-x64" | "win32-arm64" | "darwin-x64" | "darwin-arm64" | "linux-x64" | "linux-arm64";
type RuntimeAsset = { destination: string; url: string; sha256: string };

const ASSETS = runtimeLock.platforms as Record<PlatformTag, RuntimeAsset[]>;

function bytesFromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytesFromBase64(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function download(context: ManagedPluginContext, asset: RuntimeAsset): Promise<{ destination: string; data: string }> {
  const response = await context.network.request<string>({
    url: asset.url,
    headers: { Accept: "application/octet-stream" },
    responseType: "base64",
    timeoutMs: 120_000
  });
  if (!response.ok || typeof response.body !== "string") throw new Error(`Runtime download failed: HTTP ${response.status}`);
  if (await sha256(response.body) !== asset.sha256) throw new Error(`Runtime checksum mismatch: ${asset.destination}`);
  return { destination: asset.destination, data: response.body };
}

let provisioning: Promise<ServiceStatus> | undefined;

export function ensureServiceStarted(context: ManagedPluginContext): Promise<ServiceStatus> {
  if (provisioning) return provisioning;
  provisioning = (async () => {
    let status = await context.services.getStatus(SERVICE_ID);
    if (status.phase === "ready") return status;
    if (!status.installed) {
      const { tag } = await context.services.getPlatform();
      const assets = ASSETS[tag];
      if (!assets) throw new Error(`Unsupported runtime platform: ${tag}`);
      const payloads = [];
      for (const asset of assets) payloads.push(await download(context, asset));
      status = await context.services.install(SERVICE_ID, payloads);
      if (!status.installed) throw new Error(status.message ?? "Runtime installation failed");
    }
    return context.services.start(SERVICE_ID);
  })().finally(() => { provisioning = undefined; });
  return provisioning;
}

export const runtimeAssets = ASSETS;
