import { useTranslation } from "@vetta-org/plugin-sdk";
import { type JSX, type Ref, useCallback, useEffect, useRef, useState } from "react";
import { buildEmbedCss, readHostBackground } from "../runtime/embed-css.js";

/** Electron `<webview>` 运行时方法的最小接口（仅声明这里用到的）。 */
interface WebviewElement extends HTMLElement {
	loadURL(url: string): Promise<void>;
	getURL(): string;
	reload(): void;
	insertCSS(css: string): Promise<string>;
	removeInsertedCSS(key: string): Promise<void>;
}

/**
 * webview 的持久分区：让预览页记住它自己的本地偏好。
 * 名字保留插件改名前的 `ios-simulator`，不另起分区。
 */
const PARTITION = "persist:vetta-ios-simulator";

interface SimulatorWebviewProps {
	readonly url: string;
}

/**
 * 承载 serve-sim 预览页的 guest。
 *
 * 用 webview 而不是 iframe：guest 是独立的顶层浏览上下文，键盘焦点与快捷键（⌘⇧H 回主屏等）
 * 直接交给页面，不和宿主页面抢事件。两条加载约束是踩出来的，改动前请先读：
 *
 * 1. **`src` 必须是静态 `about:blank`，真实地址在 `dom-ready` 之后用 `loadURL` 加载**。
 *    直接把地址写进 `src` 时 guest 不会挂载起来（`dom-ready` 不触发），表现为一片黑。
 *    宿主自己的内置浏览器面板用的也是这个写法。
 * 2. **只在首次就绪时导航一次**。`dom-ready` 每次导航后都会再触发，如果每次都把地址拉回
 *    `url`，用户在预览页里的站内跳转会被立刻拽回来。样式注入则相反——它随文档失效，
 *    每次都要重来（内容见 embed-css）。
 */
export function SimulatorWebview({ url }: SimulatorWebviewProps): JSX.Element {
	const { t } = useTranslation();
	const hostRef = useRef<HTMLDivElement | null>(null);
	const webviewRef = useRef<WebviewElement | null>(null);
	const cssKeyRef = useRef<string | null>(null);
	/** 是否已经把 guest 导航到目标地址。之后的站内导航交给用户，不再接管。 */
	const navigatedRef = useRef(false);
	const [failure, setFailure] = useState<string | null>(null);

	/** 重新注入嵌入样式。先插新的再移除旧的，主题来回切时不叠加、也不闪回深色。 */
	const applyEmbedCss = useCallback(async (): Promise<void> => {
		const element = webviewRef.current;
		if (!element) return;
		try {
			const previous = cssKeyRef.current;
			cssKeyRef.current = await element.insertCSS(buildEmbedCss(readHostBackground(hostRef.current)));
			if (previous) await element.removeInsertedCSS(previous).catch(() => undefined);
		} catch {
			// 注入失败只是回到预览页原本的外观，不影响功能。
		}
	}, []);

	useEffect(() => {
		const element = webviewRef.current;
		if (!element) return;
		// url 变化（服务重启换了端口）时重新接管一次导航。
		navigatedRef.current = false;

		const onReady = (): void => {
			setFailure(null);
			// 样式随文档失效，每次 dom-ready 都要重新注入。
			cssKeyRef.current = null;
			void applyEmbedCss();
			if (navigatedRef.current || element.getURL() === url) return;
			navigatedRef.current = true;
			void element.loadURL(url).catch((error: unknown) => {
				navigatedRef.current = false;
				setFailure(error instanceof Error ? error.message : String(error));
			});
		};
		const onFail = (event: Event): void => {
			// errorCode -3 (ABORTED) 多因重定向或手动停止，不是真实失败。
			const detail = event as unknown as {
				errorCode: number;
				errorDescription: string;
				isMainFrame: boolean;
			};
			if (!detail.isMainFrame || detail.errorCode === -3) return;
			setFailure(`${detail.errorDescription} (${detail.errorCode})`);
		};

		element.addEventListener("dom-ready", onReady);
		element.addEventListener("did-fail-load", onFail);
		return () => {
			element.removeEventListener("dom-ready", onReady);
			element.removeEventListener("did-fail-load", onFail);
		};
	}, [applyEmbedCss, url]);

	// 宿主切换明暗时重新取色。宿主把模式写在 <html data-mode> 上。
	useEffect(() => {
		const observer = new MutationObserver(() => void applyEmbedCss());
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "class"] });
		return () => observer.disconnect();
	}, [applyEmbedCss]);

	return (
		<div ref={hostRef} className="relative min-h-0 flex-1 bg-background">
			<webview
				ref={webviewRef as unknown as Ref<HTMLElement>}
				src="about:blank"
				partition={PARTITION}
				className="h-full w-full"
			/>
			{failure ? (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
					<p className="text-sm font-medium">{t("panel.loadFailed")}</p>
					<p className="text-xs leading-relaxed text-muted-foreground">{failure}</p>
					<button
						type="button"
						className="ios-sim-button"
						onClick={() => {
							setFailure(null);
							webviewRef.current?.reload();
						}}
					>
						{t("panel.retry")}
					</button>
				</div>
			) : null}
		</div>
	);
}
