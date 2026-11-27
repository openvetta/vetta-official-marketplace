import { getPluginContext } from "../../../plugin-context";

/** 用系统默认浏览器打开来源；宿主只接受 http(s)。 */
export function openSource(url: string): void {
	void getPluginContext()?.ui.openExternal(url).catch(() => {});
}

/** 复制全部来源为 Markdown 列表。 */
export async function copySourcesAsMarkdown(lines: readonly string[]): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(lines.join("\n"));
		return true;
	} catch {
		return false;
	}
}
