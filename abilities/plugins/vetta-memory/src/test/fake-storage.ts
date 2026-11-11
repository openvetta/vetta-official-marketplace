import type { MemoryStorage } from "../domain/emitter";

/** In-memory stand-in for `ctx.storage`; list() returns full relative paths like the host. */
export class FakeStorage implements MemoryStorage {
    readonly files = new Map<string, string>();

    async readFile(path: string): Promise<string | null> {
        return this.files.get(path) ?? null;
    }

    async writeFile(path: string, data: string): Promise<void> {
        this.files.set(path, data);
    }

    async list(prefix = ""): Promise<string[]> {
        return [...this.files.keys()].filter((key) => key.startsWith(prefix));
    }
}
