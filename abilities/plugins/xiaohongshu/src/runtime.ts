import type { ManagedPluginContext } from "./runtime-contract";
import runtimeLock from "../runtime-lock.json";
import { SERVICE_ID } from "./xhs";

type PlatformTag = "win32-x64" | "win32-arm64" | "darwin-x64" | "darwin-arm64" | "linux-x64" | "linux-arm64";
type RuntimeAsset = { destination: string; url: string; sha256: string };

const assetsByPlatform = runtimeLock.platforms as Record<PlatformTag, RuntimeAsset[]>;

function sha256(value: string): Promise<string> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return crypto.subtle.digest("SHA-256", bytes).then((digest) => Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
}

export async function ensureServiceStarted(ctx: ManagedPluginContext): Promise<void> {
  let status = await ctx.services.getStatus(SERVICE_ID);
  if (status.phase === "ready" || status.phase === "starting") return;
  if (!status.installed) {
    const { tag } = await ctx.services.getPlatform();
    const assets = assetsByPlatform[tag as PlatformTag];
    if (!assets) throw new Error(`Unsupported runtime platform: ${tag}`);
    const payloads = [];
    for (const asset of assets) {
      const response = await ctx.network.request<string>({ url: asset.url, responseType: "base64", timeoutMs: 120_000 });
      if (!response.ok || typeof response.body !== "string") throw new Error(`Runtime download failed: HTTP ${response.status}`);
      if (await sha256(response.body) !== asset.sha256) throw new Error(`Runtime checksum mismatch: ${asset.destination}`);
      payloads.push({ destination: asset.destination, data: response.body });
    }
    status = await ctx.services.install(SERVICE_ID, payloads);
    if (!status.installed) throw new Error(status.message ?? "Runtime installation failed");
  }
  await ctx.services.start(SERVICE_ID);
}
