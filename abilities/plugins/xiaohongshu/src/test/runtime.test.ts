import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureServiceStarted } from "../runtime";
import type { ServicePhase, ServiceStatus } from "../runtime-contract";

function serviceStatus(
	phase: ServicePhase,
	overrides: Partial<ServiceStatus> = {},
): ServiceStatus {
	return {
		serviceId: "xhs",
		phase,
		version: "2.5.0",
		installed: true,
		recentOutput: "",
		...overrides,
	};
}

function context(statuses: ServiceStatus[]) {
	const getStatus = vi.fn(
		async () => statuses.shift() ?? serviceStatus("ready"),
	);
	const start = vi.fn(async () => serviceStatus("starting"));
	return {
		ctx: {
			services: {
				getStatus,
				start,
			},
		} as never,
		getStatus,
		start,
	};
}

describe("xiaohongshu managed service startup", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("does not complete activation while the service is only starting", async () => {
		vi.useFakeTimers();
		const { ctx, getStatus, start } = context([
			serviceStatus("starting"),
			serviceStatus("starting"),
			serviceStatus("ready"),
		]);

		const startup = ensureServiceStarted(ctx);
		await vi.advanceTimersByTimeAsync(249);
		expect(getStatus).toHaveBeenCalledTimes(2);
		expect(start).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		await startup;
		expect(getStatus).toHaveBeenCalledTimes(3);
	});

	it("waits for health readiness after starting an installed runtime", async () => {
		vi.useFakeTimers();
		const { ctx, getStatus, start } = context([
			serviceStatus("stopped"),
			serviceStatus("starting"),
			serviceStatus("ready"),
		]);

		const startup = ensureServiceStarted(ctx);
		await vi.runAllTimersAsync();
		await startup;

		expect(start).toHaveBeenCalledOnce();
		expect(start).toHaveBeenCalledWith("xhs");
		expect(getStatus).toHaveBeenCalledTimes(3);
	});

	it("shares one in-flight startup across repeated activations", async () => {
		let finishStart!: (status: ServiceStatus) => void;
		const { ctx, start } = context([serviceStatus("stopped")]);
		start.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishStart = resolve;
				}),
		);

		const first = ensureServiceStarted(ctx);
		const second = ensureServiceStarted(ctx);
		await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
		finishStart(serviceStatus("ready"));

		await Promise.all([first, second]);
		expect(start).toHaveBeenCalledOnce();
	});

	it("surfaces a failed health transition", async () => {
		const { ctx } = context([
			serviceStatus("starting"),
			serviceStatus("failed", { message: "health check failed" }),
		]);

		await expect(ensureServiceStarted(ctx)).rejects.toThrow(
			"health check failed",
		);
	});
});
