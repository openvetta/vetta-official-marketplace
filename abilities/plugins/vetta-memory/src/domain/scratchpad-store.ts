import { Emitter, parseJson, SerialQueue, type MemoryStorage } from "./emitter";
import { cleanContent, newId } from "./memory-text";
import { isVisibleIn, MAX_SCRATCH_ITEMS, type ScratchItem } from "./memory-types";

const FILE = "scratchpad.json";

export function parseScratchpad(raw: string | null): ScratchItem[] {
    const items = (parseJson(raw) as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) return [];
    const result: ScratchItem[] = [];
    for (const entry of items) {
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const text = typeof e.text === "string" ? cleanContent(e.text) : "";
        if (typeof e.id !== "string" || !text) continue;
        result.push({
            id: e.id,
            text,
            done: e.done === true,
            projectKey: typeof e.projectKey === "string" ? e.projectKey : null,
            createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
            doneAt: typeof e.doneAt === "number" ? e.doneAt : null,
        });
    }
    return result;
}

/** Checklist of things to come back to; open items are injected into every turn. */
export class ScratchpadStore extends Emitter {
    private items: ScratchItem[] = [];
    private loaded: Promise<void> | null = null;
    private readonly queue = new SerialQueue();

    constructor(private readonly storage: MemoryStorage) {
        super();
    }

    load(): Promise<void> {
        this.loaded ??= (async () => {
            this.items = parseScratchpad(await this.storage.readFile(FILE, "utf8"));
        })().catch((error: unknown) => {
            this.loaded = null;
            throw error;
        });
        return this.loaded;
    }

    /** Items visible from `cwd` (all of them when `cwd` is `undefined`), open ones first. */
    list(cwd?: string | null): ScratchItem[] {
        const visible = cwd === undefined ? this.items : this.items.filter((item) => isVisibleIn(item, cwd));
        return [...visible].sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt);
    }

    private mutate<T>(work: () => T | Promise<T>): Promise<T> {
        return this.queue.run(async () => {
            await this.load();
            const result = await work();
            await this.storage.writeFile(FILE, JSON.stringify({ schemaVersion: 1, items: this.items }, null, 2), "utf8");
            this.changed();
            return result;
        });
    }

    add(text: string, projectKey: string | null): Promise<ScratchItem> {
        return this.mutate(() => {
            const clean = cleanContent(text);
            if (!clean) throw new Error("Scratchpad item is empty");
            const existing = this.items.find(
                (item) => !item.done && item.projectKey === projectKey && item.text.toLowerCase() === clean.toLowerCase(),
            );
            if (existing) return { ...existing };
            const item: ScratchItem = { id: newId("s"), text: clean, done: false, projectKey, createdAt: Date.now(), doneAt: null };
            this.items.push(item);
            if (this.items.length > MAX_SCRATCH_ITEMS) {
                const done = this.items.filter((entry) => entry.done).sort((a, b) => a.createdAt - b.createdAt)[0];
                if (!done) throw new Error(`Scratchpad limit of ${MAX_SCRATCH_ITEMS} reached; finish or delete some items`);
                this.items = this.items.filter((entry) => entry.id !== done.id);
            }
            return { ...item };
        });
    }

    setDone(id: string, done: boolean): Promise<ScratchItem | null> {
        return this.mutate(() => {
            const item = this.items.find((entry) => entry.id === id);
            if (!item) return null;
            item.done = done;
            item.doneAt = done ? Date.now() : null;
            return { ...item };
        });
    }

    updateText(id: string, text: string): Promise<ScratchItem | null> {
        return this.mutate(() => {
            const item = this.items.find((entry) => entry.id === id);
            if (!item) return null;
            const clean = cleanContent(text);
            if (!clean) throw new Error("Scratchpad item is empty");
            item.text = clean;
            return { ...item };
        });
    }

    remove(id: string): Promise<boolean> {
        return this.mutate(() => {
            const before = this.items.length;
            this.items = this.items.filter((entry) => entry.id !== id);
            return this.items.length < before;
        });
    }

    /** Deletes finished items visible from `cwd` (all of them when `cwd` is `undefined`). */
    clearDone(cwd?: string | null): Promise<number> {
        return this.mutate(() => {
            const before = this.items.length;
            this.items = this.items.filter((item) => !(item.done && (cwd === undefined || isVisibleIn(item, cwd))));
            return before - this.items.length;
        });
    }
}
