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
      entry: "./src/index.tsx",
      // Host design-system primitives (@vetta-org/ui) and the settings chrome the app
      // exposes to plugins (@vetta-org/theme-ui/plugin-ui) come from the app singleton.
      hostUi: true,
      hostThemeUi: true
    })
  ],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  }
});
