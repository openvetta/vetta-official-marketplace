import tailwindcss from "@tailwindcss/vite";
import { vettaPluginFederation } from "@vetta-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        tailwindcss(),
        vettaPluginFederation({
            name: "vetta_generative_ui",
            entry: "./src/index.tsx",
            hostUi: true,
        }),
    ],
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
    // The sandbox stylesheet is imported as raw text; keep vitest from blanking it like an ordinary CSS import.
    test: { environment: "jsdom", css: { include: [/sandbox\/.*\.css/] } },
});
