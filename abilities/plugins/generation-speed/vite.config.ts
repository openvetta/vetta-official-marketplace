import tailwindcss from "@tailwindcss/vite";
import { vettaPluginFederation } from "@vetta-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		vettaPluginFederation({
			name: "generation_speed",
			entry: "./src/index.tsx",
			// 宿主设计系统组件（@vetta-org/ui）由应用单例提供，不打进插件包。
			hostUi: true,
		}),
	],
	esbuild: { jsx: "automatic", jsxImportSource: "react" },
});
