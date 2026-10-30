import { describe, expect, it, vi } from "vitest";

/**
 * The host activates a reloaded plugin *before* running the previous cleanup.
 * If the old cleanup owns the same module-level handle, it tears down the live
 * instance — which is exactly what produced "REA plugin is not active" in the
 * plugin report "not active" and call every installed engine "missing".
 */
describe("plugin context ownership", () => {
	it("keeps the newest activation alive when an older cleanup runs late", async () => {
		vi.resetModules();
		const module = await import("../plugin-context");
		const first = { name: "first" } as never;
		const second = { name: "second" } as never;

		const firstToken = module.setPluginContext(first);
		const secondToken = module.setPluginContext(second);

		// Late cleanup from the superseded activation must be a no-op.
		module.clearPluginContext(firstToken);
		expect(module.hasPluginContext()).toBe(true);
		expect(module.getPluginContext()).toBe(second);

		// The owner can still release it.
		module.clearPluginContext(secondToken);
		expect(module.hasPluginContext()).toBe(false);
	});

	it("throws a message the UI can act on when nothing is active", async () => {
		vi.resetModules();
		const module = await import("../plugin-context");
		expect(() => module.getPluginContext()).toThrow(/not active/u);
		expect(module.peekPluginContext()).toBeNull();
	});
});
