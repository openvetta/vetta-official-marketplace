import { describe, expect, it } from "vitest";
import { MemoryServices } from "../domain/memory-services";
import { createMemoryForgetTool } from "../tools/memory-forget";
import { createMemoryReadTool } from "../tools/memory-read";
import { createMemoryRestoreTool } from "../tools/memory-restore";
import { createMemorySearchTool } from "../tools/memory-search";
import { createMemoryStatusTool } from "../tools/memory-status";
import { createMemoryWriteTool } from "../tools/memory-write";
import { createScratchpadTool } from "../tools/scratchpad";
import { FakeStorage } from "./fake-storage";

/** Invokes a registered tool the way the host does: only `session` and `trigger.input` are used. */
async function call<T>(tool: { handler: (context: never) => unknown }, input: T, cwd = "/work/api"): Promise<any> {
    return tool.handler({ session: { id: "s1", cwd, scenario: "project" }, trigger: { input } } as never);
}

function setup() {
    const services = new MemoryServices(new FakeStorage());
    return {
        services,
        write: createMemoryWriteTool(services),
        read: createMemoryReadTool(services),
        search: createMemorySearchTool(services),
        forget: createMemoryForgetTool(services),
        restore: createMemoryRestoreTool(services),
        pad: createScratchpadTool(services),
        status: createMemoryStatusTool(services),
    };
}

describe("memory tools", () => {
    it("every tool declares scope_use, otherwise the host would never show it", () => {
        const t = setup();
        for (const tool of [t.write, t.read, t.search, t.forget, t.restore, t.pad, t.status]) {
            expect(tool.scope_use?.length).toBeGreaterThan(0);
            expect(tool.name).toMatch(/^[a-z_]+$/);
        }
    });

    it("writes long-term and daily memories, merges duplicates and refuses secrets", async () => {
        const t = setup();
        const first = await call(t.write, { content: "Always use pnpm", kind: "preference" });
        expect(first).toMatchObject({ ok: true, action: "created" });
        expect(await call(t.write, { content: "always use pnpm" })).toMatchObject({ action: "merged-with-existing" });
        expect(await call(t.write, { content: "token: abcdefghijkl" })).toMatchObject({ ok: false });
        expect(await call(t.write, { content: "Fixed the flaky test", target: "daily" })).toMatchObject({ ok: true, action: "logged" });

        const updated = await call(t.write, { id: first.memory.id, content: "Always use pnpm in monorepos" });
        expect(updated).toMatchObject({ action: "updated" });
        expect(await call(t.write, { id: "m_nope", content: "x y z" })).toMatchObject({ ok: false });
    });

    it("keeps project memories out of other projects", async () => {
        const t = setup();
        await call(t.write, { content: "API uses Stripe", scope: "project" }, "/work/api");
        const other = await call(t.search, { query: "stripe" }, "/work/web");
        expect(other.count).toBe(0);
        expect((await call(t.search, { query: "stripe" }, "/work/api")).count).toBe(1);
    });

    it("searches across sources and lists recents for an empty query", async () => {
        const t = setup();
        await call(t.write, { content: "Billing runs on Stripe #decision" });
        await call(t.write, { content: "Started the Stripe migration", target: "daily" });
        const all = await call(t.search, { query: "stripe" });
        expect(all.results.map((r: any) => r.source).sort()).toEqual(["daily", "memory"]);
        expect((await call(t.search, { query: "stripe", sources: ["daily"] })).results).toHaveLength(1);
        expect((await call(t.search, { query: "#decision" })).count).toBe(1);
        expect((await call(t.search, { query: "" })).results[0].source).toBe("memory");
        expect((await call(t.search, { query: "zzzz" })).hint).toBeTruthy();
    });

    it("forgets with a recovery id, restores once, and cannot touch other projects", async () => {
        const t = setup();
        const mine = (await call(t.write, { content: "Temporary rule to undo" })).memory.id;
        const theirs = (await call(t.write, { content: "Other project secret plan", scope: "project" }, "/other")).memory.id;

        const forgotten = await call(t.forget, { ids: [mine, theirs] });
        expect(forgotten).toMatchObject({ ok: true, removed: 1, notFound: [theirs] });
        expect((await call(t.read, { target: "long_term" }, "/other")).count).toBe(1);

        expect(await call(t.restore, { recoveryId: forgotten.recoveryId })).toEqual({ ok: true, restored: 1 });
        expect(await call(t.restore, { recoveryId: forgotten.recoveryId })).toMatchObject({ ok: false });
        expect(await call(t.restore, { recoveryId: "r_none" })).toMatchObject({ ok: false });
    });

    it("runs the scratchpad actions end to end", async () => {
        const t = setup();
        const added = await call(t.pad, { action: "add", text: "Review PR 42" });
        expect(added.list).toContain("Review PR 42");
        expect(await call(t.pad, { action: "done" })).toMatchObject({ ok: false });
        expect((await call(t.pad, { action: "done", id: added.added })).list).toContain("[x]");
        expect((await call(t.pad, { action: "undo", id: added.added })).list).toContain("[ ]");
        await call(t.pad, { action: "done", id: added.added });
        expect(await call(t.pad, { action: "clear_done" })).toMatchObject({ cleared: 1 });
        expect(await call(t.pad, { action: "remove", id: "s_none" })).toMatchObject({ ok: false });
        expect(await call(t.pad, { action: "nope" })).toMatchObject({ ok: false });
    });

    it("reads files and reports status", async () => {
        const t = setup();
        await call(t.write, { content: "Uses Neovim", pinned: true });
        await call(t.write, { content: "Shipped it", target: "daily" });
        expect((await call(t.read, { target: "daily" })).text).toContain("Shipped it");
        expect((await call(t.read, { target: "list_daily" })).dates).toHaveLength(1);
        expect(await call(t.read, { target: "weird" })).toMatchObject({ ok: false });
        expect(await call(t.status, {})).toMatchObject({ enabled: true, longTerm: { total: 1, pinned: 1 }, dailyLogDays: 1 });
    });

    it("tells the model memory is off instead of failing silently", async () => {
        const t = setup();
        await t.services.memories.updateSettings({ enabled: false });
        for (const [tool, input] of [[t.write, { content: "x y z" }], [t.search, { query: "x" }], [t.pad, { action: "list" }]] as const) {
            expect(await call(tool, input)).toMatchObject({ ok: false, error: expect.stringContaining("turned off") });
        }
    });
});
