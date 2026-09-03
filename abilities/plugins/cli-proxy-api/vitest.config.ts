import { defineConfig, type Plugin } from "vitest/config";

function stubProviderAssets(): Plugin {
  return {
    name: "stub-provider-assets",
    enforce: "pre",
    load(id) {
      const filePath = id.split("?")[0] ?? "";
      if (!/\.(png|svg)$/u.test(filePath)) return;
      const fileName = filePath.replaceAll("\\", "/").split("/").pop() ?? "icon";
      return `export default ${JSON.stringify(`/assets/providers/${fileName}`)};`;
    }
  };
}

export default defineConfig({
  plugins: [stubProviderAssets()],
  esbuild: { jsx: "automatic" },
  test: { environment: "jsdom", include: ["test/**/*.test.ts", "test/**/*.test.tsx"] }
});
