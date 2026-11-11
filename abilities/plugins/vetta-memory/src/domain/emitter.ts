/** Minimal change notifier shared by the stores; `revision` bumps on every change. */
export class Emitter {
    revision = 0;
    private readonly listeners = new Set<() => void>();

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    protected changed(): void {
        this.revision++;
        for (const listener of this.listeners) listener();
    }
}

/** Runs async work strictly one after another so read-modify-write cycles never interleave. */
export class SerialQueue {
    private tail: Promise<unknown> = Promise.resolve();

    run<T>(work: () => T | Promise<T>): Promise<T> {
        const next = this.tail.then(work);
        this.tail = next.catch(() => undefined);
        return next;
    }
}

/** The slice of `ctx.storage` the stores need; keeps them testable with a fake. */
export interface MemoryStorage {
    readFile(path: string, encoding: "utf8"): Promise<string | null>;
    writeFile(path: string, data: string, encoding: "utf8"): Promise<unknown>;
    list(prefix?: string): Promise<string[]>;
}

export function parseJson(raw: string | null): unknown {
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
}
