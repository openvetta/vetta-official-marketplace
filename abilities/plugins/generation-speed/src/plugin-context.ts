import type { PluginContext } from "@vetta-org/plugin-sdk";

let current: PluginContext | null = null;

/** activate 时保存插件上下文，供组件里的命令式能力（打开外链）使用。 */
export function setPluginContext(ctx: PluginContext | null): void {
	current = ctx;
}

export function getPluginContext(): PluginContext | null {
	return current;
}
