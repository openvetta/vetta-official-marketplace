import type { PluginContext } from "@vetta-org/plugin-sdk";

/**
 * Module-level handle to the activation context.
 *
 * Agent tool handlers and hook handlers run in this same renderer realm, so they
 * need the context that was captured during `activate()`.
 *
 * The host hot-reloads a plugin by activating the new instance *before* the
 * previous cleanup runs. A cleanup that blindly nulls this handle therefore
 * tears down the instance that is already serving calls — the plugin then fails
 * with "not active" and every probe that needs `ctx` looks like a missing
 * install. Ownership is therefore recorded per activation: only the activation
 * that currently owns the handle may clear it.
 */
let context: PluginContext | null = null;
let activation = 0;

/** Take ownership of the handle; returns the token this activation must release with. */
export function setPluginContext(next: PluginContext): number {
	context = next;
	activation += 1;
	return activation;
}

/** Release the handle only if `token` is still the owner. */
export function clearPluginContext(token?: number): void {
	if (token === undefined || token === activation) {
		context = null;
	}
}

export function getPluginContext(): PluginContext {
	if (!context) throw new Error("REA plugin is not active");
	return context;
}

export function hasPluginContext(): boolean {
	return context !== null;
}

/** Non-throwing read for code that must degrade instead of failing. */
export function peekPluginContext(): PluginContext | null {
	return context;
}

/**
 * Wait briefly for an activation to take ownership.
 *
 * A surface can be mounted a moment before (or during) the plugin's activation —
 * an ability detail page restored at startup, a workspace route opened from a
 * deep link. Rendering "not active" there is a lie; waiting a beat is the truth.
 */
export async function waitForPluginContext(timeoutMs = 3000, stepMs = 100): Promise<PluginContext | null> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (context) return context;
		await new Promise((resolve) => setTimeout(resolve, stepMs));
	}
	return context;
}

let notify: PluginContext["ui"]["notify"] | null = null;

export function setNotify(next: PluginContext["ui"]["notify"]): void {
	notify = next;
}

/** Surface a failure with its stack instead of a bare red line. */
export function reportError(message: string, error?: unknown): void {
	if (notify) {
		notify({ message, error, variant: error ? "error" : "warning" });
		return;
	}
	console.error(`[rea] ${message}`, error);
}
