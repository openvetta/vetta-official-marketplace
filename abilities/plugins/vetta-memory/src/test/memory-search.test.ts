import { describe, expect, it } from "vitest";
import { searchMemories } from "../domain/memory-search";
import { extractLabels, looksSensitive, tailText, tokenize } from "../domain/memory-text";
import type { MemoryRecord } from "../domain/memory-types";

function record(id: string, content: string, extra: Partial<MemoryRecord> = {}): MemoryRecord {
    return { id, content, kind: "fact", scope: "global", projectKey: null, pinned: false, source: "user", createdAt: 1, updatedAt: 1, ...extra };
}

describe("tokenize", () => {
    it("keeps #tags, [[links]], latin words and CJK bigrams", () => {
        const tokens = tokenize("#decision [[database-choice]] Use PostgreSQL 数据库");
        expect(tokens).toEqual(expect.arrayContaining(["#decision", "[[database-choice]]", "postgresql", "数据", "据库"]));
    });

    it("extracts labels case-insensitively", () => {
        expect(extractLabels("#Editor [[LazyVim]] #editor")).toEqual({ tags: ["#editor"], links: ["lazyvim"] });
    });
});

describe("searchMemories", () => {
    const items = [
        record("a", "Always use pnpm, never npm #preference"),
        record("b", "The database is PostgreSQL #decision"),
        record("c", "Deploys happen on Fridays", { scope: "project", projectKey: "/work/api" }),
        record("d", "Prefers dark mode", { pinned: true, updatedAt: 5 }),
    ];

    it("ranks by keyword relevance", () => {
        expect(searchMemories(items, "postgresql database", { cwd: null })[0].id).toBe("b");
    });

    it("matches #tags", () => {
        expect(searchMemories(items, "#preference", { cwd: null }).map((r) => r.id)).toEqual(["a"]);
    });

    it("matches Chinese text through bigrams", () => {
        const zh = [record("z", "用户偏好使用深色主题"), record("y", "项目使用 PostgreSQL")];
        expect(searchMemories(zh, "深色主题", { cwd: null })[0].id).toBe("z");
    });

    it("hides other projects' memories unless allProjects is set", () => {
        expect(searchMemories(items, "deploys", { cwd: "/work/web" })).toEqual([]);
        expect(searchMemories(items, "deploys", { cwd: "/work/api" })).toHaveLength(1);
        expect(searchMemories(items, "deploys", { allProjects: true })).toHaveLength(1);
    });

    it("lists pinned then newest for an empty query", () => {
        expect(searchMemories(items, "", { cwd: null })[0].id).toBe("d");
    });
});

describe("text helpers", () => {
    it("flags credentials", () => {
        expect(looksSensitive("my key is sk-abcdefghijklmnopqrstuvwxyz")).toBe(true);
        expect(looksSensitive("password: hunter22")).toBe(true);
        expect(looksSensitive("I prefer tabs")).toBe(false);
    });

    it("keeps the tail on a line boundary", () => {
        expect(tailText("one\ntwo\nthree", 9)).toBe("three");
        expect(tailText("short", 50)).toBe("short");
    });
});
