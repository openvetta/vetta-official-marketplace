/** 卡片图标：与 12px 正文同高的 14px，生成中换成实心图标。 */
export function SpeedIcon({ live }: { live: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={`block size-3.5 ${live ? "icon-[solar--speedometer-max-bold]" : "icon-[solar--speedometer-middle-linear]"}`}
		/>
	);
}
