import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: { environment: "jsdom", include: ["test/**/*.test.ts", "test/**/*.test.tsx"] }
});
