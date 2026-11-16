import type { SandboxLib, SandboxLibSources } from "../html-document";

/** Each library is its own chunk: it is only fetched when a view asks for it. */
const LOADERS: Record<SandboxLib, () => Promise<string>> = {
    tailwind: async () => (await import("@tailwindcss/browser?raw")).default,
    // chart.js only exports ESM entries; the sandbox needs the classic-script UMD build.
    chartjs: async () => (await import("../../../node_modules/chart.js/dist/chart.umd.js?raw")).default,
};

export async function loadSandboxLibs(libs: readonly SandboxLib[]): Promise<SandboxLibSources> {
    const entries = await Promise.all([...new Set(libs)].map(async (lib) => [lib, await LOADERS[lib]()] as const));
    return Object.fromEntries(entries);
}
