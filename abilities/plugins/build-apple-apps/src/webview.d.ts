import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * Electron `<webview>`。宿主主窗口开启了 webviewTag，内置浏览器面板用的就是它。
 *
 * 选它而不是 iframe 的原因见 SimulatorWebview：guest 是独立的顶层浏览上下文，键盘与
 * 快捷键直接交给预览页，不与宿主页面抢事件。
 */
declare module "react" {
	namespace JSX {
		interface IntrinsicElements {
			webview: DetailedHTMLProps<
				HTMLAttributes<HTMLElement> & {
					src?: string;
					partition?: string;
					allowpopups?: boolean;
				},
				HTMLElement
			>;
		}
	}
}
