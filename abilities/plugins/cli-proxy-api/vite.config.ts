import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { vettaPluginFederation } from "@vetta-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "cli-proxy-api-runtime-resources",
      generateBundle() {
        for (const source of ["assets/config.yaml.tpl", "detail.json", "detail.zh.json", "LICENSE", "upstream.json"]) {
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
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  }
});
