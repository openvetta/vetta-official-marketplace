import type { ManagedPluginContext } from "./runtime-contract";
import runtimeLock from "../runtime-lock.json";
import { SERVICE_ID } from "./xhs";

type PlatformTag =
	| "win32-x64"
	| "win32-arm64"
	| "darwin-x64"
	| "darwin-arm64"
	| "linux-x64"
	| "linux-arm64";
type RuntimeAsset = { destination: string; url: string; sha256: string };
type ServiceStatus = Awaited<
	ReturnType<ManagedPluginContext["services"]["getStatus"]>
>;

const assetsByPlatform = runtimeLock.platforms as Record<
	PlatformTag,
	RuntimeAsset[]
>;

// Activation can be replayed while the host refreshes plugin contributions.
// Share one in-flight startup so two activations cannot both decide that the
// runtime is missing and start competing downloads/installs.
let startup: Promise<void> | undefined;

function sha256(value: string): Promise<string> {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return crypto.subtle
		.digest("SHA-256", bytes)
		.then((digest) =>
			Array.from(new Uint8Array(digest), (byte) =>
				byte.toString(16).padStart(2, "0"),
			).join(""),
		);
}

async function waitForStatus(
	ctx: ManagedPluginContext,
	accept: (status: ServiceStatus) => boolean,
	operation: string,
): Promise<ServiceStatus> {
	const deadline = Date.now() + 120_000;
	while (Date.now() < deadline) {
		const status = await ctx.services.getStatus(SERVICE_ID);
		if (status.phase === "failed") {
			throw new Error(status.message ?? `${operation} failed`);
		}
		if (accept(status)) return status;
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`${operation} timed out`);
}

export async function ensureServiceStarted(
	ctx: ManagedPluginContext,
): Promise<void> {
	if (startup) return startup;
	startup = ensureServiceStartedOnce(ctx).finally(() => {
		startup = undefined;
	});
	return startup;
}

async function ensureServiceStartedOnce(
	ctx: ManagedPluginContext,
): Promise<void> {
	let status = await ctx.services.getStatus(SERVICE_ID);
	if (status.phase === "ready") return;
	if (status.phase === "starting") {
		await waitForStatus(
			ctx,
			(next) => next.phase === "ready",
			"Service startup",
		);
		return;
	}
	if (status.phase === "installing") {
		status = await waitForStatus(
			ctx,
			(next) => next.phase !== "installing",
			"Runtime installation",
		);
		if (status.phase === "ready") return;
	}
	if (status.phase === "stopping") {
		status = await waitForStatus(
			ctx,
			(next) => next.phase !== "stopping",
			"Service shutdown",
		);
		if (status.phase === "ready") return;
	}
	if (!status.installed) {
		const { tag } = await ctx.services.getPlatform();
		const assets = assetsByPlatform[tag as PlatformTag];
		if (!assets) throw new Error(`Unsupported runtime platform: ${tag}`);
		const payloads = [];
		for (const asset of assets) {
			const response = await ctx.network.request<string>({
				url: asset.url,
				responseType: "base64",
				timeoutMs: 120_000,
			});
			if (!response.ok || typeof response.body !== "string") {
				throw new Error(`Runtime download failed: HTTP ${response.status}`);
			}
			if ((await sha256(response.body)) !== asset.sha256) {
				throw new Error(`Runtime checksum mismatch: ${asset.destination}`);
			}
			payloads.push({ destination: asset.destination, data: response.body });
		}
		status = await ctx.services.install(SERVICE_ID, payloads);
		if (!status.installed) {
			throw new Error(status.message ?? "Runtime installation failed");
		}
	}
	status = await ctx.services.start(SERVICE_ID);
	if (status.phase !== "ready") {
		await waitForStatus(
			ctx,
			(next) => next.phase === "ready",
			"Service startup",
		);
	}
}
