import type { PluginNotifyOptions } from "@vetta-org/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pelicanStore } from "../domain/pelican-state";
import { createPelicanBikeControlTool, type PelicanBikeControlInput } from "../tools/pelican-bike-control";

function setup(openPanel = vi.fn()) {
	const notify = vi.fn<(options: PluginNotifyOptions) => void>();
	const tool = createPelicanBikeControlTool({ openPanel, notify, t: (key) => key });
	const call = (input: PelicanBikeControlInput) =>
		tool.handler({
			trigger: { input },
			session: { id: "session-1", cwd: "/work", scenario: "conversation" },
		} as unknown as Parameters<typeof tool.handler>[0]) as Record<string, unknown>;
	return { call, notify, openPanel };
}

describe("pelican_bike_control", () => {
	beforeEach(() => pelicanStore.reset());

	it("applies combined actions and opens the panel in the calling session's cwd", () => {
		const { call, openPanel } = setup();
		const result = call({ speed: 8, jumps: 3, ringBell: 2, scene: "night" });

		expect(result.ok).toBe(true);
		expect(result.status).toMatchObject({ speed: 8, scene: "night", totalJumps: 3, totalBells: 2 });
		expect(pelicanStore.getState()).toMatchObject({ pendingJumps: 3, pendingBells: 2 });
		expect(openPanel).toHaveBeenCalledWith("/work");
	});

	it("only reads status when no field is given", () => {
		const { call, openPanel } = setup();
		const result = call({});

		expect(result).toMatchObject({ ok: true, performed: ["status only"], status: { speed: 3, scene: "day" } });
		expect(openPanel).not.toHaveBeenCalled();
	});

	it("rejects an invalid scene without applying other fields", () => {
		const { call, openPanel } = setup();
		const result = call({ speed: 9, scene: "snow" as PelicanBikeControlInput["scene"] });

		expect(result.ok).toBe(false);
		expect(pelicanStore.getState().speed).toBe(3);
		expect(openPanel).not.toHaveBeenCalled();
	});

	it("clamps action counts", () => {
		const { call } = setup();
		call({ jumps: 99, ringBell: 0 });
		expect(pelicanStore.getState()).toMatchObject({ totalJumps: 5, totalBells: 1 });
	});

	it("reports a panel failure through notify and still succeeds", () => {
		const failure = new Error("no panel");
		const { call, notify } = setup(
			vi.fn(() => {
				throw failure;
			}),
		);
		const result = call({ speed: 1 });

		expect(result.ok).toBe(true);
		expect(notify).toHaveBeenCalledWith({ message: "error.openPanel", error: failure });
	});
});
