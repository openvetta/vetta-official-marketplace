import { useEffect, useState } from "react";
import { resolveFavicon } from "../../features/turn-sources/services/favicon-resolver";

/**
 * 网站图标：由宿主网络请求取回站点声明的图标，转成 data URL 显示。
 * 加载中显示地球图标，取不到时显示域名首字母。
 */
export function SiteFavicon({ domain, className = "" }: { domain: string; className?: string }) {
	const [icon, setIcon] = useState<{ domain: string; src: string | null } | null>(null);

	useEffect(() => {
		let cancelled = false;
		void resolveFavicon(domain).then((src) => {
			if (!cancelled) setIcon({ domain, src });
		});
		return () => {
			cancelled = true;
		};
	}, [domain]);

	const current = icon?.domain === domain ? icon : null;
	const base = `flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-background ${className}`;

	if (current?.src) {
		return (
			<span aria-hidden="true" className={base}>
				<img src={current.src} alt="" draggable={false} className="size-3 object-contain" />
			</span>
		);
	}
	if (current) {
		return (
			<span aria-hidden="true" className={`${base} text-[9px] font-semibold uppercase text-foreground/70`}>
				{domain.charAt(0)}
			</span>
		);
	}
	return (
		<span aria-hidden="true" className={`${base} text-muted-foreground`}>
			<span className="icon-[solar--global-linear] block size-3" />
		</span>
	);
}
