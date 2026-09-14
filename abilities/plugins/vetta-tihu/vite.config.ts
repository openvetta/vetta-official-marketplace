import tailwindcss from "@tailwindcss/vite";
import { vettaPluginFederation } from "@vetta-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		vettaPluginFederation({
			name: "vetta_tihu",
			entry: "./src/index.tsx",
		}),
	],
	esbuild: { jsx: "automatic", jsxImportSource: "react" },
});
