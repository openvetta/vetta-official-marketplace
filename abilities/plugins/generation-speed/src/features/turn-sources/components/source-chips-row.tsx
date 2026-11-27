import { useTranslation } from "@vetta-org/plugin-sdk";
import { domainOf, type TurnSource } from "../../../domain/turn-sources";
import { SiteFavicon } from "../../../shared/components/site-favicon";
import { openSource } from "../services/open-source";

/** 来源不超过这个数时逐个列出；超过就收成网站图标组 +「xxx 等 n 个来源」。 */
export const MAX_LISTED_SOURCES = 3;
/** 图标组最多叠几个网站图标。 */
const STACKED_ICONS = 3;

const ROW_CLASS = "flex max-w-full min-w-0 items-center gap-1.5 px-1 py-0.5 text-[12px] leading-4 text-muted-foreground";
const SHOW_ALL_CLASS =
	"shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors hover:bg-accent/40 hover:text-foreground";

/** 每个站点取它在本轮的第一个来源，点图标就打开这个页面。 */
function firstSourcePerSite(sources: readonly TurnSource[]): { domain: string; source: TurnSource }[] {
	const sites = new Map<string, TurnSource>();
	for (const source of sources) {
		const domain = domainOf(source.url);
		if (!sites.has(domain)) sites.set(domain, source);
	}
	return [...sites].map(([domain, source]) => ({ domain, source }));
}

/**
 * 卡片第二行：本轮来源。点击范围只到内容本身，不铺满整行。
 * - 不超过 3 个：「网站图标 + 域名」标签，点击在外部浏览器打开，紧跟「全部 n 个来源」；
 * - 超过 3 个：叠放的网站图标（各自点击在浏览器打开）+「xxx 等 n 个来源」（打开详情）。
 */
export function SourceChipsRow({ sources, onShowAll }: { sources: readonly TurnSource[]; onShowAll: () => void }) {
	const { t } = useTranslation();
	if (sources.length === 0) return null;

	if (sources.length > MAX_LISTED_SOURCES) {
		const sites = firstSourcePerSite(sources);
		return (
			<div className={ROW_CLASS}>
				<span className="flex shrink-0 items-center pl-0.5">
					{sites.slice(0, STACKED_ICONS).map(({ domain, source }, index) => (
						<button
							key={domain}
							type="button"
							title={source.url}
							aria-label={domain}
							onClick={() => openSource(source.url)}
							className={`relative cursor-pointer rounded-full transition-transform hover:z-10 hover:-translate-y-px ${index > 0 ? "-ml-1" : ""}`}
						>
							<SiteFavicon domain={domain} />
						</button>
					))}
				</span>
				<button type="button" onClick={onShowAll} aria-haspopup="dialog" className={`${SHOW_ALL_CLASS} min-w-0 truncate`}>
					{t("sources.collapsed", { site: sites[0].domain, count: sources.length })}
				</button>
			</div>
		);
	}

	return (
		<div className={ROW_CLASS}>
			<span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
				<span className="icon-[solar--link-round-linear] block size-3.5" />
			</span>
			{sources.map((source) => {
				const domain = domainOf(source.url);
				return (
					<button
						key={source.url}
						type="button"
						title={source.title ? `${source.title}\n${source.url}` : source.url}
						aria-label={domain}
						onClick={() => openSource(source.url)}
						className="flex min-w-0 max-w-40 shrink cursor-pointer items-center gap-1 rounded-md bg-muted/60 py-0.5 pr-1.5 pl-1 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
					>
						<SiteFavicon domain={domain} className="ring-0" />
						<span className="truncate">{domain}</span>
					</button>
				);
			})}
			<button type="button" onClick={onShowAll} aria-haspopup="dialog" className={SHOW_ALL_CLASS}>
				{t("sources.showAll", { count: sources.length })}
			</button>
		</div>
	);
}
