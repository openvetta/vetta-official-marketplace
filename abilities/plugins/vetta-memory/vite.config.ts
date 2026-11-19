import tailwindcss from "@tailwindcss/vite";
import { vettaPluginFederation } from "@vetta-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        tailwindcss(),
        vettaPluginFederation({
            name: "vetta_memory",
            entry: "./src/index.tsx",
            // Host design-system primitives (@vetta-org/ui) come from the app singleton.
            hostUi: true,
        }),
    ],
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
    test: { environment: "jsdom" },
});
