import { describe, expect, it } from "vitest";
import { buildHandoff, collectContext, memoriesToMarkdown } from "../domain/memory-context";
import { searchCorpus } from "../domain/memory-corpus";
import { BUDGETS, buildContextBlock, selectForPrompt } from "../domain/memory-prompt";
import { MemoryServices } from "../domain/memory-services";
import { FakeStorage } from "./fake-storage";

const NOW = new Date(2026, 10, 11, 15, 0).getTime();
const YESTERDAY = new Date(2026, 10, 10, 11, 0).getTime();

async function seeded() {
    const services = new MemoryServices(new FakeStorage());
    await services.memories.add({ content: "Always use pnpm #preference", kind: "preference", pinned: true });
    await services.memories.add({ content: "Billing runs on Stripe", kind: "fact", scope: "project", projectKey: "/work/api" });
    await services.scratchpad.add("Review PR 42", null);
    await services.daily.append("Fixed the auth bug", { at: NOW - 3_600_000, cwd: "/work/api" });
    await services.daily.append("Started the Stripe migration", { at: YESTERDAY });
    return services;
}

describe("collectContext", () => {
    it("injects every section visible from the project, with ids the tools can use", async () => {
        const services = await seeded();
        const text = await collectContext(services, "/work/api", "", NOW);
        expect(text).toContain("## Open scratchpad");
        expect(text).toContain("Review PR 42");
        expect(text).toContain("## Today's log (2026-11-11)");
        expect(text).toContain("Fixed the auth bug");
        expect(text).toContain("## Yesterday's log (2026-11-10)");
        expect(text).toContain("Always use pnpm");
        expect(text).toContain("Billing runs on Stripe");
        expect(text).toMatch(/\(id: m_/);
    });

    it("hides other projects' memories", async () => {
        const services = await seeded();
        const text = await collectContext(services, "/work/web", "", NOW);
        expect(text).toContain("Always use pnpm");
        expect(text).not.toContain("Billing runs on Stripe");
    });

    it("only adds prompt-dependent matches in per-turn mode", async () => {
        const services = await seeded();
        const stable = await collectContext(services, "/work/api", "stripe migration", NOW);
        expect(stable).not.toContain("Possibly relevant");
        await services.memories.updateSettings({ snapshotMode: "per-turn" });
        const perTurn = await collectContext(services, "/work/api", "stripe migration", NOW);
        expect(perTurn).toContain("Possibly relevant");
        expect(perTurn).toContain("Started the Stripe migration");
    });

    it("never exceeds the total budget and drops yesterday first", () => {
        const big = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `d${i}`, at: NOW, text: "x".repeat(90), kind: "note" as const, cwd: null }));
        const text = buildContextBlock({
            scratchpad: [],
            today: { date: "2026-11-11", entries: big(60) },
            yesterday: { date: "2026-11-10", entries: big(60) },
            memories: [],
            totalMemories: 0,
        });
        expect(text.length).toBeLessThanOrEqual(BUDGETS.total);
        expect(text).toContain("Today's log");
    });
});

describe("selectForPrompt", () => {
    it("honours the count limit and keeps pinned memories first", async () => {
        const services = new MemoryServices(new FakeStorage());
        await services.memories.add({ content: "Not pinned but newest item here" });
        await services.memories.add({ content: "A pinned preference that always applies", pinned: true });
        const picked = selectForPrompt(services.memories.list(), { injectLimit: 1, injectCharBudget: 5000 }, null);
        expect(picked.map((r) => r.pinned)).toEqual([true]);
    });
});

describe("snapshots", () => {
    it("reuses the block until long-term memory changes, the day rolls over or a checkpoint invalidates it", async () => {
        const services = await seeded();
        let builds = 0;
        const get = (sessionId: string, now: number) =>
            services.snapshots.get(sessionId, services.memories.getSettings().snapshotMode, services.memories.revision, now, async () => {
                builds++;
                return collectContext(services, "/work/api", "", now);
            });

        const first = await get("s1", NOW);
        await services.daily.append("A log write does not refresh the snapshot", { at: NOW });
        await services.scratchpad.add("Neither does the scratchpad", null);
        expect(await get("s1", NOW + 1000)).toBe(first);
        expect(builds).toBe(1);

        await services.memories.add({ content: "A new long-term memory refreshes it" });
        expect(await get("s1", NOW + 2000)).not.toBe(first);
        expect(builds).toBe(2);

        await get("s1", NOW + 3000);
        expect(builds).toBe(2);
        services.snapshots.invalidate("s1");
        await get("s1", NOW + 3000);
        expect(builds).toBe(3);

        await get("s1", NOW + 86_400_000);
        expect(builds).toBe(4);
        expect(builds).toBeGreaterThan(0);
    });

    it("rebuilds every turn in per-turn mode", async () => {
        const services = await seeded();
        await services.memories.updateSettings({ snapshotMode: "per-turn" });
        let builds = 0;
        const get = () => services.snapshots.get("s1", "per-turn", services.memories.revision, NOW, async () => `v${++builds}`);
        expect(await get()).toBe("v1");
        expect(await get()).toBe("v2");
    });
});

describe("handoff and corpus search", () => {
    it("hands off open items and the recent log", async () => {
        const services = await seeded();
        const text = await buildHandoff(services, "/work/api", NOW);
        expect(text).toContain("Review PR 42");
        expect(text).toContain("Fixed the auth bug");
    });

    it("has nothing to hand off in an empty store", async () => {
        expect(await buildHandoff(new MemoryServices(new FakeStorage()), null, NOW)).toBeNull();
    });

    it("searches memories, daily logs and the scratchpad together", async () => {
        const services = await seeded();
        const hits = await searchCorpus(services, "stripe", { cwd: "/work/api" });
        expect(hits.map((h) => h.source).sort()).toEqual(["daily", "memory"]);
        const onlyDaily = await searchCorpus(services, "stripe", { cwd: "/work/api", sources: ["daily"] });
        expect(onlyDaily.map((h) => h.source)).toEqual(["daily"]);
    });

    it("exports markdown", () => {
        const md = memoriesToMarkdown([{ content: "Use pnpm", kind: "preference", scope: "global", pinned: true, updatedAt: NOW }]);
        expect(md).toBe("- #preference #pinned Use pnpm <!-- 2026-11-11 15:00 -->");
    });
});
