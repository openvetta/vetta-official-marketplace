import { describe, expect, it } from "vitest";
import { MemoryServices } from "../domain/memory-services";
import { FakeStorage } from "./fake-storage";

function setup() {
    const storage = new FakeStorage();
    return { storage, services: new MemoryServices(storage) };
}

describe("MemoryStore", () => {
    it("merges near-duplicates instead of repeating them", async () => {
        const { services } = setup();
        const first = await services.memories.add({ content: "User prefers pnpm over npm" });
        const second = await services.memories.add({ content: "user prefers pnpm over npm", pinned: true });
        expect(first.created).toBe(true);
        expect(second.created).toBe(false);
        expect(services.memories.list()).toHaveLength(1);
        expect(services.memories.list()[0].pinned).toBe(true);
    });

    it("serialises concurrent writes without losing any", async () => {
        const { services, storage } = setup();
        await Promise.all(Array.from({ length: 10 }, (_, i) => services.memories.add({ content: `distinct fact number ${i} about topic${i}` })));
        expect(services.memories.list()).toHaveLength(10);
        expect(JSON.parse(storage.files.get("memories.json") ?? "{}").items).toHaveLength(10);
    });

    it("rejects a project memory without a directory", async () => {
        const { services } = setup();
        await expect(services.memories.add({ content: "x y z", scope: "project" })).rejects.toThrow(/project directory/);
    });

    it("reloads what it persisted and clamps invalid settings", async () => {
        const { services, storage } = setup();
        await services.memories.add({ content: "Persisted fact" });
        await services.memories.updateSettings({ injectLimit: 9999, snapshotMode: "per-turn" });
        const reloaded = new MemoryServices(storage);
        await reloaded.loadAll();
        expect(reloaded.memories.list()).toHaveLength(1);
        expect(reloaded.memories.getSettings()).toMatchObject({ injectLimit: 100, snapshotMode: "per-turn" });
    });

    it("bumps the revision on every change", async () => {
        const { services } = setup();
        const before = services.memories.revision;
        await services.memories.add({ content: "Something durable to remember" });
        expect(services.memories.revision).toBeGreaterThan(before);
    });
});

describe("recoverable deletion", () => {
    it("restores forgotten memories once", async () => {
        const { services } = setup();
        const { record } = await services.memories.add({ content: "Temporary decision to revert", kind: "decision" });
        const { removed, recoveryId } = await services.forget([record.id], "agent");
        expect(removed).toHaveLength(1);
        expect(services.memories.list()).toHaveLength(0);
        expect(recoveryId).toBeTruthy();

        expect(await services.restore(recoveryId!)).toEqual({ status: "restored", count: 1 });
        expect(services.memories.list()[0]).toMatchObject({ id: record.id, kind: "decision" });
        expect(await services.restore(recoveryId!)).toEqual({ status: "already-restored" });
        expect(await services.restore("r_missing")).toEqual({ status: "not-found" });
    });

    it("keeps nothing to recover when no id matches", async () => {
        const { services } = setup();
        expect(await services.forget(["nope"], "user")).toEqual({ removed: [], recoveryId: null });
        expect(services.recovery.list()).toHaveLength(0);
    });

    it("saves a recovery copy when everything is cleared", async () => {
        const { services } = setup();
        await services.memories.add({ content: "First thing worth keeping" });
        await services.memories.add({ content: "Second unrelated thing entirely" });
        expect(await services.clearAllMemories()).toBe(2);
        expect(services.recovery.list()[0]).toMatchObject({ reason: "clear" });
        expect(services.recovery.list()[0].records).toHaveLength(2);
    });
});

describe("scratchpad", () => {
    it("scopes items to a project and clears finished ones", async () => {
        const { services } = setup();
        const global = await services.scratchpad.add("Renew the certificate", null);
        await services.scratchpad.add("Fix the flaky test", "/work/api");
        expect(services.scratchpad.list("/work/web").map((i) => i.text)).toEqual(["Renew the certificate"]);
        expect(services.scratchpad.list("/work/api")).toHaveLength(2);

        await services.scratchpad.setDone(global.id, true);
        expect(services.scratchpad.list("/work/web")[0].done).toBe(true);
        expect(await services.scratchpad.clearDone("/work/web")).toBe(1);
        expect(services.scratchpad.list("/work/web")).toEqual([]);
    });

    it("does not duplicate an open item", async () => {
        const { services } = setup();
        const a = await services.scratchpad.add("Write the docs", null);
        const b = await services.scratchpad.add("write the docs", null);
        expect(b.id).toBe(a.id);
        expect(services.scratchpad.list()).toHaveLength(1);
    });
});

describe("daily log", () => {
    it("appends per local day and lists dates newest first", async () => {
        const { services, storage } = setup();
        const day1 = new Date(2026, 10, 10, 9, 30).getTime();
        const day2 = new Date(2026, 10, 11, 14, 5).getTime();
        await services.daily.append("Started the migration", { at: day1, cwd: "/work/api" });
        await services.daily.append("Finished the migration", { at: day2 });
        expect(await services.daily.listDates()).toEqual(["2026-11-11", "2026-11-10"]);
        expect(await services.daily.readDay("2026-11-10")).toHaveLength(1);
        expect([...storage.files.keys()].sort()).toEqual(["daily/2026-11-10.json", "daily/2026-11-11.json"]);

        const fresh = new MemoryServices(storage);
        expect(await fresh.daily.listDates()).toEqual(["2026-11-11", "2026-11-10"]);
        expect((await fresh.daily.readDay("2026-11-11"))[0].text).toBe("Finished the migration");
    });

    it("removes a single entry", async () => {
        const { services } = setup();
        const at = new Date(2026, 10, 11, 8, 0).getTime();
        const entry = await services.daily.append("Wrong note", { at });
        expect(await services.daily.removeEntry("2026-11-11", entry.id)).toBe(true);
        expect(await services.daily.readDay("2026-11-11")).toEqual([]);
    });
});
