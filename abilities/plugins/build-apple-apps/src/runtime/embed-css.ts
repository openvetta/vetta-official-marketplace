/**
 * 注入 serve-sim 预览页的修正样式（webview.insertCSS）。刻意只有两条：
 *
 * - **页面底色跟随宿主**：预览页只有深色主题，底色来自 `.bg-page` 的 `--color-page`
 *   （#0a0a0a）。设备外框、顶部设备胶囊和底部按钮条都是自带深色底的浮层，换成浅色底
 *   依然清晰，所以只换这一个变量，不去重绘它的控件。
 * - **隐藏左上角的「serve-sim」品牌链接**：它在面板里没有用途，点击会把 webview 导航到
 *   GitHub，用户回不来。旁边打开设备列表的按钮是灰色（#8e8e93），深浅两种底色上都可见，
 *   保留。
 *
 * 选择器是 serve-sim 的内部实现，升级版本后可能失配；失配只是退回它原本的外观，不影响
 * 功能。升级 SERVE_SIM_PACKAGE 时在深浅两种主题下各看一眼。
 */
export function buildEmbedCss(pageBackground: string): string {
	return `
:root { --color-page: ${pageBackground} !important; }
a[aria-label="Open serve-sim"] { display: none !important; }
`;
}

/** 宿主取不到 `--background` 时的回落：与预览页原本的底色一致。 */
export const FALLBACK_PAGE_BACKGROUND = "#0a0a0a";

/**
 * 从插件自己的 DOM 节点读宿主的 `--background`。插件 CSS 被包进以插件根为界的
 * `@scope`，但自定义属性会继承下来，从节点本身读才不依赖宿主把变量定义在哪一层。
 */
export function readHostBackground(node: Element | null): string {
	if (!node) return FALLBACK_PAGE_BACKGROUND;
	const value = getComputedStyle(node).getPropertyValue("--background").trim();
	return value.length > 0 ? value : FALLBACK_PAGE_BACKGROUND;
}
