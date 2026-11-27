import { useTranslation } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta-org/ui";
import { useState } from "react";
import { domainOf, type TurnSource } from "../../../domain/turn-sources";
import { copySourcesAsMarkdown, openSource } from "../services/open-source";

/**
 * 详情对话框的「来源」页：编号列表，点击在浏览器打开，可一键复制为 Markdown。
 * 对话框挂在 body 上：只用宿主全局样式已有的类名。
 */
export function SourceListPanel({ sources }: { sources: readonly TurnSource[] }) {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);

	if (sources.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("sources.empty")}</div>
		);
	}

	const copy = async () => {
		const lines = sources.map((source, index) => `${index + 1}. [${source.title ?? domainOf(source.url)}](${source.url})`);
		setCopied(await copySourcesAsMarkdown(lines));
	};

	return (
		<div className="flex h-full min-h-0 flex-col gap-3">
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs text-muted-foreground">{t("sources.summary", { count: sources.length })}</span>
				<Button variant="field" size="xs" onClick={() => void copy()}>
					{copied ? t("sources.copied") : t("sources.copyMarkdown")}
				</Button>
			</div>
			<ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
				{sources.map((source, index) => (
					<li key={source.url}>
						<button
							type="button"
							onClick={() => openSource(source.url)}
							className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent/40"
						>
							<span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
							<span className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-sm font-medium text-foreground">
									{source.title ?? domainOf(source.url)}
								</span>
								<span className="truncate text-xs text-muted-foreground">{source.url}</span>
							</span>
							<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
								{t(source.origin === "reply" ? "sources.originReply" : "sources.originFetched")}
							</span>
						</button>
					</li>
				))}
			</ol>
		</div>
	);
}
