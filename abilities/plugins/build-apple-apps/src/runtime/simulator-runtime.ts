import type { PluginCommandApi, PluginCommandSpawnHandle } from "@vetta-org/plugin-sdk";
import { buildServeArgs, type KeyboardIssue, parseKeyboardIssue, parseServePort, SERVE_SIM_ENV } from "./serve-sim-command.js";

/**
 * 面板的运行时状态机：托管 serve-sim 预览服务。
 *
 * 设备选择、开机、画面和输入都归 serve-sim 自带的预览页（见 serve-url），这里刻意不重复
 * 实现——插件只负责「服务在不在、能不能打开」。
 *
 * 进程生命周期归宿主：spawn 走独立进程组，插件禁用/卸载/退出时统一回收整棵进程树。
 */

export const RUNTIME_COMMAND = "npx";

export type ServerPhase = "unsupported" | "idle" | "starting" | "running" | "failed";

export interface RuntimeState {
	readonly phase: ServerPhase;
	/** 服务实际监听的端口；只在 running 时存在。 */
	readonly port?: number;
	/** 启动失败时的错误与最近输出，原样给用户看。 */
	readonly failure?: string;
	/**
	 * 用户还没在能力详情里打开 `npx` 命令开关。宿主不会自动授权新声明的命令（升级时只沿用
	 * 上一版已授权的命令），这是装完后最常见的失败，面板要直接告诉用户去哪里打开。
	 */
	readonly commandDisabled?: boolean;
	/**
	 * 运行中 serve-sim 报告的键盘问题（Xcode 27 下按键送不进模拟器的原因）。只在 running
	 * 时存在；serve-sim 恢复正常时不打印任何东西，所以它会一直保留到服务重启。
	 */
	readonly keyboardIssue?: KeyboardIssue;
}

export interface RuntimePorts {
	readonly command: PluginCommandApi;
	readonly platform: string;
	/** 测试注入：等待服务就绪时的轮询间隔；缺省为真实计时器。 */
	readonly sleep?: (ms: number) => Promise<void>;
	/** 测试注入：运行期间读取诊断输出的间隔；缺省为真实计时器。 */
	readonly diagnosticsSleep?: (ms: number) => Promise<void>;
}

/** 首次运行要从 npm 下载 serve-sim（约 5 MB），并可能顺带启动一台模拟器，给足时间。 */
const READY_TIMEOUT_MS = 180_000;
const READY_POLL_MS = 400;
/** 运行中读取输出的间隔：只为发现键盘问题，慢一点无妨。 */
const DIAGNOSTICS_POLL_MS = 2_000;

/** 宿主拒绝未授权命令时的报错：`Plugin <id> command disabled by user: npx`。 */
export function isCommandDisabledError(message: string): boolean {
	return /command disabled by user/i.test(message);
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class SimulatorRuntimeController {
	private state: RuntimeState;
	private readonly listeners = new Set<(state: RuntimeState) => void>();
	private disposed = false;
	private handle: PluginCommandSpawnHandle | null = null;
	private starting: Promise<void> | null = null;

	constructor(private readonly ports: RuntimePorts) {
		this.state = { phase: ports.platform === "darwin" ? "idle" : "unsupported" };
	}

	current(): RuntimeState {
		return this.state;
	}

	subscribe(listener: (state: RuntimeState) => void): () => void {
		this.listeners.add(listener);
		listener(this.state);
		return () => this.listeners.delete(listener);
	}

	private emit(next: RuntimeState): void {
		if (this.disposed) return;
		this.state = next;
		for (const listener of this.listeners) listener(next);
	}

	/** 保证服务在跑。并发调用共享同一次启动；已在运行或不支持时直接返回。 */
	async ensureServer(): Promise<void> {
		if (this.state.phase === "unsupported" || this.state.phase === "running") return;
		if (this.starting) return this.starting;
		this.starting = this.start().finally(() => {
			this.starting = null;
		});
		return this.starting;
	}

	private async start(): Promise<void> {
		this.emit({ phase: "starting" });
		let handle: PluginCommandSpawnHandle;
		try {
			handle = await this.ports.command.spawn(RUNTIME_COMMAND, buildServeArgs(), {
				allocatePort: true,
				env: { ...SERVE_SIM_ENV },
			});
		} catch (error) {
			// npx 未授权、被用户关掉、或宿主没有可用的 Node 运行时。
			const failure = errorMessage(error);
			this.emit({ phase: "failed", failure, commandDisabled: isCommandDisabledError(failure) });
			return;
		}
		this.handle = handle;
		handle.onExit((exit) => {
			if (this.handle !== handle) return;
			this.handle = null;
			// 运行中退出（模拟器关了、进程崩了）回到 idle，面板会提示重新启动。
			if (this.state.phase === "running") this.emit({ phase: "idle" });
			else if (this.state.phase === "starting") {
				this.emit({ phase: "failed", failure: `serve-sim exited (code ${exit.exitCode ?? exit.signal ?? "?"})` });
			}
		});

		const sleep = this.ports.sleep ?? defaultSleep;
		const deadline = Date.now() + READY_TIMEOUT_MS;
		while (!this.disposed && this.handle === handle) {
			const status = await handle.status().catch(() => null);
			if (!status) break;
			const port = parseServePort(status.recentOutput);
			if (port !== null) {
				this.emit({ phase: "running", port });
				void this.watchDiagnostics(handle, port);
				return;
			}
			if (!status.running) {
				this.handle = null;
				this.emit({ phase: "failed", failure: status.recentOutput.trim() || "serve-sim exited before it was ready" });
				return;
			}
			if (Date.now() > deadline) {
				this.handle = null;
				await handle.stop().catch(() => undefined);
				this.emit({ phase: "failed", failure: status.recentOutput.trim() || "serve-sim did not become ready in time" });
				return;
			}
			await sleep(READY_POLL_MS);
		}
	}

	/** 运行期间定期读输出，把键盘问题带到面板上；进程换了或退出就停。 */
	private async watchDiagnostics(handle: PluginCommandSpawnHandle, port: number): Promise<void> {
		const sleep = this.ports.diagnosticsSleep ?? defaultSleep;
		while (!this.disposed && this.handle === handle && this.state.phase === "running") {
			await sleep(DIAGNOSTICS_POLL_MS);
			if (this.disposed || this.handle !== handle || this.state.phase !== "running") return;
			const status = await handle.status().catch(() => null);
			if (!status?.running) return;
			const issue = parseKeyboardIssue(status.recentOutput) ?? undefined;
			if (issue?.reason !== this.state.keyboardIssue?.reason) {
				this.emit({ phase: "running", port, keyboardIssue: issue });
			}
		}
	}

	/** 停掉当前服务并重新拉起。 */
	async restart(): Promise<void> {
		await this.stop();
		await this.ensureServer();
	}

	async stop(): Promise<void> {
		const handle = this.handle;
		this.handle = null;
		if (this.state.phase !== "unsupported") this.emit({ phase: "idle" });
		if (handle) await handle.stop().catch(() => undefined);
	}

	async dispose(): Promise<void> {
		this.disposed = true;
		this.listeners.clear();
		const handle = this.handle;
		this.handle = null;
		if (handle) await handle.stop().catch(() => undefined);
	}
}
