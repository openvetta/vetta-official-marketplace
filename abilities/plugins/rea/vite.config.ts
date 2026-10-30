import { vettaPluginFederation } from "@vetta-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		vettaPluginFederation({
			name: "rea",
			entry: "./src/index.ts",
		}),
	],
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
});
