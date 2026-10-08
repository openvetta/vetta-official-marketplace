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
