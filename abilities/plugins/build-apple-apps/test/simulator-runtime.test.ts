import type { PluginCommandApi, PluginCommandSpawnExit, PluginCommandSpawnHandle } from "@vetta-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { SimulatorRuntimeController } from "../src/runtime/simulator-runtime.js";

interface FakeProcess {
	output: string;
	running: boolean;
	exit?: (exit: PluginCommandSpawnExit) => void;
}

function fakeCommand(process: FakeProcess): { command: PluginCommandApi; stop: ReturnType<typeof vi.fn> } {
	const stop = vi.fn(async () => {
		process.running = false;
	});
	const handle: PluginCommandSpawnHandle = {
		spawnId: "s1",
		pid: 42,
		port: 3200,
		stop,
		status: async () => ({ running: process.running, pid: 42, port: 3200, recentOutput: process.output }),
		onExit: (listener) => {
			process.exit = listener;
			return { dispose: () => undefined };
		},
	};
	return {
		command: { run: vi.fn(), spawn: vi.fn(async () => handle) } as unknown as PluginCommandApi,
		stop,
	};
}

describe("SimulatorRuntimeController", () => {
	it("refuses to start off macOS", async () => {
		const process: FakeProcess = { output: "", running: true };
		const { command } = fakeCommand(process);
		const controller = new SimulatorRuntimeController({ command, platform: "other" });
		await controller.ensureServer();
		expect(controller.current().phase).toBe("unsupported");
		expect(command.spawn).not.toHaveBeenCalled();
	});

	it("is running only once serve-sim prints its address", async () => {
		const process: FakeProcess = { output: "Starting simulator stream...", running: true };
		const { command } = fakeCommand(process);
		let polls = 0;
		const controller = new SimulatorRuntimeController({
			command,
			platform: "darwin",
			sleep: async () => {
				polls += 1;
				if (polls === 2) process.output += "\n  - Local:   http://localhost:3201\n";
			},
		});
		await controller.ensureServer();
		// -p 只是起始端口：以输出里的实际端口为准。
		expect(controller.current()).toEqual({ phase: "running", port: 3201 });
		expect(command.spawn).toHaveBeenCalledWith("npx", expect.arrayContaining(["-p", "{{PORT}}"]), {
			allocatePort: true,
			env: { NSUnbufferedIO: "YES" },
		});
	});

	it("reports the process output when serve-sim exits before it is ready", async () => {
		const process: FakeProcess = { output: "xcrun: error: unable to find utility \"simctl\"", running: false };
		const { command } = fakeCommand(process);
		const controller = new SimulatorRuntimeController({ command, platform: "darwin", sleep: async () => undefined });
		await controller.ensureServer();
		expect(controller.current()).toEqual({
			phase: "failed",
			failure: 'xcrun: error: unable to find utility "simctl"',
		});
	});

	it("flags the host refusing npx until the user switches it on", async () => {
		// 宿主升级插件时只沿用上一版已授权的命令，新声明的 npx 默认是关的。
		const command = {
			run: vi.fn(),
			spawn: vi.fn(async () => {
				throw new Error("Plugin build-apple-apps command disabled by user: npx");
			}),
		} as unknown as PluginCommandApi;
		const controller = new SimulatorRuntimeController({ command, platform: "darwin" });
		await controller.ensureServer();
		expect(controller.current()).toEqual({
			phase: "failed",
			failure: "Plugin build-apple-apps command disabled by user: npx",
			commandDisabled: true,
		});
	});

	it("reports other spawn rejections as they are", async () => {
		const command = {
			run: vi.fn(),
			spawn: vi.fn(async () => {
				throw new Error("spawn npx ENOENT");
			}),
		} as unknown as PluginCommandApi;
		const controller = new SimulatorRuntimeController({ command, platform: "darwin" });
		await controller.ensureServer();
		expect(controller.current()).toEqual({ phase: "failed", failure: "spawn npx ENOENT", commandDisabled: false });
	});

	it("shares one start between concurrent callers", async () => {
		const process: FakeProcess = { output: "Local:   http://localhost:3200", running: true };
		const { command } = fakeCommand(process);
		const controller = new SimulatorRuntimeController({ command, platform: "darwin" });
		await Promise.all([controller.ensureServer(), controller.ensureServer()]);
		expect(command.spawn).toHaveBeenCalledTimes(1);
	});

	it("surfaces a keyboard issue serve-sim reports while running", async () => {
		const process: FakeProcess = { output: "Local:   http://localhost:3200\n", running: true };
		const { command } = fakeCommand(process);
		let ticks = 0;
		let controller: SimulatorRuntimeController | null = null;
		controller = new SimulatorRuntimeController({
			command,
			platform: "darwin",
			diagnosticsSleep: async () => {
				ticks += 1;
				if (ticks === 1) {
					process.output +=
						"[hid] Device Hub keyboard unavailable for iPhone 17 Pro (EE592E58): Device Hub has no visible simulator window; using legacy HID\n";
				}
				// 第二次读完就让进程退出，结束诊断循环。
				if (ticks === 3) process.running = false;
			},
		});
		await controller.ensureServer();
		await vi.waitFor(() => expect(controller?.current().keyboardIssue?.kind).toBe("window"));
		expect(controller.current().phase).toBe("running");
	});

	it("falls back to idle when a running server exits", async () => {
		const process: FakeProcess = { output: "Local:   http://localhost:3200", running: true };
		const { command } = fakeCommand(process);
		const controller = new SimulatorRuntimeController({ command, platform: "darwin" });
		await controller.ensureServer();
		process.exit?.({ exitCode: 0, signal: null });
		expect(controller.current().phase).toBe("idle");
	});

	it("stops the process on restart and starts a new one", async () => {
		const process: FakeProcess = { output: "Local:   http://localhost:3200", running: true };
		const { command, stop } = fakeCommand(process);
		const controller = new SimulatorRuntimeController({ command, platform: "darwin" });
		await controller.ensureServer();
		process.running = true;
		await controller.restart();
		expect(stop).toHaveBeenCalledTimes(1);
		expect(command.spawn).toHaveBeenCalledTimes(2);
		expect(controller.current().phase).toBe("running");
	});
});
