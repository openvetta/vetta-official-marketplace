import type { JSX } from "react";

/** 内联 SVG：插件不依赖宿主的图标字体，避免主题替换后图标消失。 */
export function DeviceIcon(): JSX.Element {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			className="h-6 w-6"
			aria-hidden="true"
		>
			<rect x="6" y="2.5" width="12" height="19" rx="3" />
			<path d="M10 18.8h4" strokeLinecap="round" />
		</svg>
	);
}
