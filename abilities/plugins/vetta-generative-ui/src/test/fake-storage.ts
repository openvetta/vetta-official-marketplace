import type { PluginStorageApi } from "@vetta-org/plugin-sdk";

export class FakeStorage implements Pick<PluginStorageApi, "readFile" | "writeFile"> {
    readonly files = new Map<string, string>();

    async readFile(path: string): Promise<string | null> {
        return this.files.get(path) ?? null;
    }

    async writeFile(path: string, data: string) {
        this.files.set(path, data);
        return { revision: String(this.files.size), changedPaths: [path] };
    }
}
