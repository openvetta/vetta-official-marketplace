import type { PluginNotifyOptions } from "@vetta-org/plugin-sdk";

/** 宿主 Toast 上报函数（`ctx.ui.notify`），在插件装配时注入各功能。 */
export type Notify = (options: PluginNotifyOptions) => void;
