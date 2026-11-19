import { defineConfig } from "vitest/config";

export default defineConfig({
  // The host UI package ships TSX sources; they need the automatic JSX runtime
  // just like this plugin's own files.
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    environment: "jsdom",
    include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"]
  }
});
