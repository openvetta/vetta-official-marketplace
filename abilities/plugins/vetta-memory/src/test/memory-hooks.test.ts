import { describe, expect, it, vi } from "vitest";
import { parseExtraction } from "../domain/memory-extraction";
import { MemoryServices } from "../domain/memory-services";
import { parseSummary } from "../domain/session-summary";
import { SessionTracker } from "../domain/session-tracker";
import { extractMemories } from "../hooks/auto-extractor";
import { summarizeSession } from "../hooks/session-summarizer";
import { FakeStorage } from "./fake-storage";

function deps(reply: string, services = new MemoryServices(new FakeStorage())) {
    const complete = vi.fn(async () => ({ text: reply }));
    const onError = vi.fn();
    return { services, complete, onError, ai: { services, complete, onError } };
}

describe("SessionTracker", () => {
    it("pairs a prompt with its reply and caps the buffer", () => {
        const tracker = new SessionTracker();
        tracker.recordPrompt("s", "hello there");
        expect(tracker.recordReply("s", "hi")).toEqual({ user: "hello there", assistant: "hi" });
        expect(tracker.recordReply("s", "orphan reply")).toBeNull();
        for (let i = 0; i < 20; i++) {
            tracker.recordPrompt("s", `q${i}`);
            tracker.recordReply("s", `a${i}`);
        }
        expect(tracker.exchanges("s")).toHaveLength(12);
        expect(tracker.take("s")).toHaveLength(12);
        expect(tracker.exchanges("s")).toEqual([]);
    });
});

describe("parseExtraction", () => {
    it("tolerates code fences, drops secrets and keeps at most three", () => {
        const reply = '```json\n{"memories":[{"content":"Uses pnpm","kind":"preference"},{"content":"password: hunter22"},{"content":"b"},{"content":"c"},{"content":"d"}]}\n```';
        const result = parseExtraction(reply, "/work/api");
        expect(result.map((m) => m.content)).toEqual(["Uses pnpm", "b", "c"]);
        expect(result[0]).toMatchObject({ kind: "preference", source: "auto" });
    });

    it("falls back to global scope without a project and ignores garbage", () => {
        expect(parseExtraction('{"memories":[{"content":"Fact","scope":"project"}]}', null)[0].scope).toBe("global");
        expect(parseExtraction("no json here", "/x")).toEqual([]);
    });
});

describe("extractMemories", () => {
    const exchange = { user: "I always deploy on Fridays, remember that", assistant: "Noted." };

    it("does nothing while auto-extract is off", async () => {
        const d = deps('{"memories":[{"content":"Deploys on Fridays"}]}');
        expect(await extractMemories(d.ai, "/work/api", exchange)).toBe(0);
        expect(d.complete).not.toHaveBeenCalled();
    });

    it("stores extracted memories and reports model failures without throwing", async () => {
        const d = deps('{"memories":[{"content":"Deploys on Fridays","kind":"fact"}]}');
        await d.services.memories.updateSettings({ autoExtract: true });
        expect(await extractMemories(d.ai, "/work/api", exchange)).toBe(1);
        expect(d.services.memories.list()[0]).toMatchObject({ content: "Deploys on Fridays", source: "auto" });

        const failing = { ...d.ai, complete: vi.fn(async () => { throw new Error("model down"); }) };
        expect(await extractMemories(failing, "/work/api", exchange)).toBe(0);
        expect(d.onError).toHaveBeenCalledOnce();
    });

    it("shows the model only memories visible from the project", async () => {
        const d = deps('{"memories":[]}');
        await d.services.memories.updateSettings({ autoExtract: true });
        await d.services.memories.add({ content: "Secret roadmap of another repo", scope: "project", projectKey: "/other" });
        await extractMemories(d.ai, "/work/api", exchange);
        const call = d.complete.mock.calls[0] as unknown as [{ prompt: string }];
        expect(call[0].prompt).not.toContain("another repo");
    });
});

describe("session summary", () => {
    const exchanges = [
        { user: "Migrate the billing table", assistant: "Done, added an index." },
        { user: "Now update the docs", assistant: "Docs updated." },
    ];

    it("writes the summary to the daily log", async () => {
        const d = deps("- Migrated the billing table\n- Updated the docs");
        expect(await summarizeSession(d.ai, "/work/api", exchanges)).toBe(true);
        const [date] = await d.services.daily.listDates();
        const entries = await d.services.daily.readDay(date);
        expect(entries[0]).toMatchObject({ kind: "summary", cwd: "/work/api" });
        expect(entries[0].text).toContain("Migrated the billing table");
    });

    it("skips short sessions, a disabled setting, NONE and secrets", async () => {
        const d = deps("- Something");
        expect(await summarizeSession(d.ai, "/x", exchanges.slice(0, 1))).toBe(false);
        await d.services.memories.updateSettings({ sessionSummary: false });
        expect(await summarizeSession(d.ai, "/x", exchanges)).toBe(false);
        expect(d.complete).not.toHaveBeenCalled();
        expect(parseSummary("NONE")).toBeNull();
        expect(parseSummary("token: abcdef123456")).toBeNull();
    });
});
