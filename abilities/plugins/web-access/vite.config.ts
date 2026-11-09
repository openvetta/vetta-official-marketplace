import tailwindcss from "@tailwindcss/vite";
import { vettaPluginFederation } from "@vetta-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
  // The remote is served from this plugin's own dist directory, so relative asset
  // URLs stay on that plugin origin instead of the host /assets root.
  base: "./",
  plugins: [
    tailwindcss(),
    vettaPluginFederation({
      name: "web_access",
      entry: "./src/index.tsx"
    })
  ],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  }
});
