/**
 * serve-sim 的启动参数与输出解析。纯函数，不碰进程。
 *
 * serve-sim 通过 npm 分发，插件经清单声明的 `npx` 启动它；宿主会把 `npx` 交给自带的
 * Node 运行时，用户无需另装 Node 或 Homebrew 包。
 */

/**
 * 锁定的 serve-sim 版本。不用 `@latest`：上游迭代很快，内嵌页面的布局与参数随时可能变，
 * 升级应当是一次经过验证的版本提升。
 */
export const SERVE_SIM_PACKAGE = "serve-sim@0.1.47";

/**
 * `npx` 的参数。
 *
 * - `--yes`：首次运行时不等待安装确认（spawn 没有 TTY，确认提示会让进程永远挂住）；
 * - `-p {{PORT}}`：宿主分配的空闲端口，serve-sim 在该端口提供页面与流；
 * - `--panes none`：活动面板很窄，收起设备列表与工具侧栏，只留设备画面；
 * - `--fit`：设备按面板尺寸缩放，而不是按原始点数溢出。
 *
 * 不传设备：serve-sim 会接上所有已启动的模拟器，没有时自己启动一台。
 */
export function buildServeArgs(): string[] {
	return ["--yes", SERVE_SIM_PACKAGE, "-p", "{{PORT}}", "--panes", "none", "--fit"];
}

/**
 * 从 serve-sim 的输出里读出它真正监听的端口（`Local:   http://localhost:3200`）。
 * 出现这一行才说明页面已经可以加载；`-p` 只是起始端口，被占用时它会顺延。
 */
export function parseServePort(output: string): number | null {
	const match = /Local:\s+http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/.exec(output);
	if (!match) return null;
	const port = Number(match[1]);
	return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/**
 * 启动 serve-sim 时附加的环境变量。
 *
 * 键盘诊断（见 parseKeyboardIssue）由它的原生插件用 Swift `print` 写到 stdout。输出接的是
 * 宿主的管道而不是终端时，stdio 会整块缓冲，诊断可能永远不出现在 recentOutput 里；
 * `NSUnbufferedIO=YES` 让 Foundation 关掉缓冲（实测管道下立即可读）。
 */
export const SERVE_SIM_ENV: Readonly<Record<string, string>> = { NSUnbufferedIO: "YES" };

/**
 * 为什么键盘输入到不了模拟器。
 *
 * Xcode 27 起 iOS 模拟器不再接收 CoreSimulator 旧的键盘注入，serve-sim 改为把按键转交给
 * Device Hub，由 Device Hub 里这台模拟器的窗口送进 iOS。前提不满足时它会打印一行
 * `[hid] Device Hub keyboard unavailable for <设备> (<udid>): <原因>; using legacy HID`，
 * 然后退回旧注入——在 Xcode 27 上等于按键丢失。点击与滑动不走这条路，不受影响。
 */
export type KeyboardIssueKind =
	/** 拉起 serve-sim 的应用（Vetta）没有辅助功能权限，不能投递按键。 */
	| "accessibility"
	/** Device Hub 没在运行。 */
	| "device-hub"
	/**
	 * 找不到这台模拟器的 Device Hub 窗口，或它不是 Device Hub 的当前窗口。macOS 27.0.1 +
	 * Xcode 27.0 上 serve-sim 0.1.47 拿到的 Device Hub 进程号是 -1，窗口开着也会落到这一类；
	 * 修复见 https://github.com/EvanBacon/serve-sim/pull/164 ，发布后提升 SERVE_SIM_PACKAGE。
	 */
	| "window"
	| "other";

export interface KeyboardIssue {
	readonly kind: KeyboardIssueKind;
	readonly device: string;
	readonly reason: string;
}

const KEYBOARD_ISSUE = /\[hid\] Device Hub keyboard unavailable for (.+?) \([0-9A-Fa-f-]+\): (.+?); using legacy HID/g;

function classify(reason: string): KeyboardIssueKind {
	if (/Accessibility permission/i.test(reason)) return "accessibility";
	if (/is not running|exited during/i.test(reason)) return "device-hub";
	if (/window/i.test(reason)) return "window";
	return "other";
}

/**
 * 取输出里**最后一次**键盘问题。serve-sim 只在原因变化时打印，恢复正常时不打印任何东西，
 * 所以调用方应只看新增的输出（见 SimulatorRuntimeController 的偏移量），而不是整段历史。
 */
export function parseKeyboardIssue(output: string): KeyboardIssue | null {
	let last: RegExpExecArray | null = null;
	for (const match of output.matchAll(KEYBOARD_ISSUE)) last = match;
	if (!last) return null;
	const reason = last[2].trim();
	return { kind: classify(reason), device: last[1].trim(), reason };
}
