import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { vettaPluginFederation } from "@vetta-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
  // This remote is served from the plugin-specific dist directory. A relative base
  // keeps emitted image URLs on that plugin origin instead of the host /assets root.
  base: "./",
  plugins: [
    {
      name: "cli-proxy-api-runtime-resources",
      generateBundle() {
        for (const source of [
          "assets/config.yaml.tpl",
          "assets/providers/lobe-icons.json",
          "assets/providers/LOBE-ICONS-LICENSE",
          "detail.json",
          "detail.zh.json",
          "LICENSE",
          "upstream.json"
        ]) {
          this.emitFile({
            type: "asset",
            fileName: source.startsWith("assets/") ? source : `assets/${source}`,
            source: readFileSync(new URL(source, import.meta.url))
          });
        }
      }
    },
    tailwindcss(),
    vettaPluginFederation({
      name: "cli_proxy_api",
      entry: "./src/index.tsx"
    })
  ],
  build: {
    // Keep provider icons as real asset URLs. Inlined data: images trip Electron/Chromium
    // site_info origin checks (opaque origins have no valid precursor tuple). Combined with
    // the relative base above, Vite resolves them against import.meta.url at runtime.
    assetsInlineLimit: 0
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  }
});
