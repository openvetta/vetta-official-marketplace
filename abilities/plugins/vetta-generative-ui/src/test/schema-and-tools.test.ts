import { describe, expect, it } from "vitest";
import { buildHtmlDocument, FALLBACK_PALETTE, parseBridgeMessage } from "../domain/html-document";
import { registerPromptProvider } from "../prompt/register-prompt-provider";
import { VISUAL_ANSWER_GUIDANCE } from "../prompt/visual-answer-guidance";
import { loadSandboxLibs } from "../domain/sandbox/lib-loaders";
import { formatSubmission, validateForm } from "../domain/form-values";
import { type FormBlock, uiDocumentSchema, uiToolParameters } from "../domain/ui-schema";
import { createRenderHtmlTool } from "../tools/render-html";
import { createRenderUiTool } from "../tools/render-ui";

const call = (tool: { handler: (context: never) => unknown }, input: unknown): Promise<any> =>
    Promise.resolve(tool.handler({ session: { id: "s", cwd: "/w", scenario: "conversation" }, trigger: { input } } as never));

const form: FormBlock = {
    type: "form",
    title: "Trip",
    fields: [
        { name: "city", label: "City", kind: "select", required: true, options: [{ label: "Paris", value: "par" }, { label: "Tokyo", value: "tyo" }] },
        { name: "days", label: "Days", kind: "number", min: 1, max: 30 },
        { name: "extras", label: "Extras", kind: "multiselect", options: [{ label: "Museums", value: "museum" }, { label: "Food", value: "food" }] },
    ],
};

describe("render_ui schema", () => {
    it("accepts a composed view and rejects nested containers and choices without options", () => {
        const ok = uiDocumentSchema.safeParse({
            title: "Q3",
            blocks: [
                { type: "stats", items: [{ label: "Revenue", value: "$12k", delta: "+8%", trend: "up" }] },
                { type: "columns", columns: [{ blocks: [{ type: "text", text: "a" }] }, { blocks: [form] }] },
                { type: "chart", chartType: "bar", data: { labels: ["a"], datasets: [{ data: [1] }] } },
            ],
        });
        expect(ok.success).toBe(true);
        expect(uiDocumentSchema.safeParse({ blocks: [{ type: "card", blocks: [{ type: "tabs", tabs: [] }] }] }).success).toBe(false);
        const deep = (inner: unknown) => ({ blocks: [{ type: "tabs", tabs: [{ label: "a", blocks: [{ type: "columns", weights: [2, 1], columns: [{ blocks: [{ type: "card", blocks: [inner] }] }, { blocks: [{ type: "divider" }] }] }] }, { label: "b", blocks: [{ type: "divider" }] }] }] });
        expect(uiDocumentSchema.safeParse(deep({ type: "text", text: "three levels deep" })).success).toBe(true);
        // A fourth container level is refused.
        expect(uiDocumentSchema.safeParse(deep({ type: "card", blocks: [{ type: "divider" }] })).success).toBe(false);
        expect(uiDocumentSchema.safeParse({ width: "wide", blocks: [{ type: "form", columns: 2, fields: [{ name: "a", label: "A", kind: "text" }, { name: "b", label: "B", kind: "text", span: "full" }] }] }).success).toBe(true);
        expect(uiDocumentSchema.safeParse({ blocks: [{ type: "form", fields: [{ name: "x", label: "X", kind: "radio" }] }] }).success).toBe(false);
        expect(uiDocumentSchema.safeParse({ blocks: [{ type: "text", text: "x", color: "red" }] }).success).toBe(false);
    });

    it("tolerates bare-block columns and extra keys, which the host would otherwise reject up front", () => {
        const view = { blocks: [{ type: "columns", columns: [{ blocks: [{ type: "text", text: "a" }] }, { type: "alert", text: "b" }, { type: "divider" }] }] };
        const parsed = uiDocumentSchema.safeParse(view);
        expect(parsed.success).toBe(true);
        expect(JSON.stringify(uiToolParameters())).not.toContain('"additionalProperties":false');
    });

    it("accepts card-shaped columns with blocks and keeps their heading and description", () => {
        const parsed = uiDocumentSchema.parse({ blocks: [{ type: "columns", columns: [
            { type: "card", title: "建议", description: "按场景选择", blocks: [{ type: "text", text: "内容" }] },
            { blocks: [{ type: "text", text: "另一个列" }] },
        ] }] });
        const column = (parsed.blocks[0] as any).columns[0];
        expect(column.blocks[0]).toMatchObject({ type: "card", title: "建议", description: "按场景选择" });
    });

    it("gives the model a compact, ref-free schema", () => {
        const text = JSON.stringify(uiToolParameters());
        expect(text).not.toContain("$ref");
        expect(text).not.toContain("oneOf");
        expect(text.length).toBeLessThan(16_000);
        for (const key of ["weights", "span", "width"]) expect(text).toContain(`"${key}"`);
        for (const kind of ["form", "chart", "table", "stats", "actions", "tabs"]) expect(text).toContain(`"const":"${kind}"`);
    });
});

describe("tools", () => {
    it("declares chat scopes and returns fixable issues for a broken view", async () => {
        const tool = createRenderUiTool();
        expect(tool.scope_use).toEqual(["conversation", "project"]);
        const bad = await call(tool, { blocks: [{ type: "table", columns: [] }] });
        expect(bad.ok).toBe(false);
        expect(bad.issues[0]).toMatch(/^blocks\.0\.columns/);
    });

    it("tells the model to wait when the view asks the user for input", async () => {
        const result = await call(createRenderUiTool(), { blocks: [{ type: "card", blocks: [form] }] });
        expect(result).toMatchObject({ ok: true, awaitingUser: ['form "Trip"'] });
        expect(await call(createRenderUiTool(), { blocks: [{ type: "text", text: "hi" }] })).not.toHaveProperty("awaitingUser");
    });

    it("validates HTML input", async () => {
        expect(await call(createRenderHtmlTool(), { html: "<p>x</p>" })).toMatchObject({ ok: true });
        expect(await call(createRenderHtmlTool(), { html: "" })).toMatchObject({ ok: false });
        // Seen in practice: the model adds the host's `md_intro` habit; that must not fail the whole view.
        expect(await call(createRenderHtmlTool(), { html: "<p>x</p>", md_intro: "intro" })).toMatchObject({ ok: true });
        expect(await call(createRenderHtmlTool(), { html: "<p>x</p>", libs: ["tailwind"] })).toMatchObject({ ok: true });
        expect(await call(createRenderHtmlTool(), { html: "<p>x</p>", libs: ["jquery"] })).toMatchObject({ ok: false });
        expect(uiDocumentSchema.safeParse({ md_intro: "intro", blocks: [{ type: "divider" }] }).success).toBe(true);
    });
});

describe("form values", () => {
    it("enforces required and numeric range, and reports exact values back", () => {
        expect(validateForm(form, { city: "", days: 40, extras: [] })).toEqual({ city: "required", days: "range" });
        const message = formatSubmission(form, { city: "tyo", days: 5, extras: ["food"] });
        expect(message).toContain("- City: Tokyo");
        expect(message).toContain("- Extras: Food");
        expect(message).toContain('"city": "tyo"');
    });
});

describe("html document libraries", () => {
    it("ships the Vetta base styles by default and the vendored libraries only when requested", async () => {
        const plain = buildHtmlDocument("<select></select>", FALLBACK_PALETTE);
        expect(plain).toContain("@layer vg-base");
        expect(plain).toContain("vg-select-menu");
        expect(plain).not.toContain("text/tailwindcss");
        const libs = await loadSandboxLibs(["chartjs", "tailwind"]);
        expect(libs.chartjs).toContain("Chart");
        const full = buildHtmlDocument("<p>x</p>", FALLBACK_PALETTE, libs);
        expect(full).toContain('<style type="text/tailwindcss">');
        expect(full).toContain("Chart.defaults.color");
        expect(full.split("</script").length - 1).toBeGreaterThanOrEqual(5);
    });
});

describe("html document", () => {
    it("injects the CSP, theme and bridge into fragments and full documents", () => {
        for (const html of ["<p>hi</p>", "<html><head><title>t</title></head><body>x</body></html>"]) {
            const doc = buildHtmlDocument(html, FALLBACK_PALETTE);
            expect(doc).toContain("connect-src 'none'");
            expect(doc).toContain("--vg-primary");
            expect(doc).toContain("window.vetta");
            expect(doc).toContain("::-webkit-scrollbar { display: none; }");
        }
    });

    it("accepts only well-formed bridge messages", () => {
        expect(parseBridgeMessage({ source: "vetta-generative-ui", kind: "resize", height: 300 })).toEqual({ kind: "resize", height: 300 });
        expect(parseBridgeMessage({ source: "vetta-generative-ui", kind: "scroll", top: false, bottom: true })).toEqual({ kind: "scroll", top: false, bottom: true });
        expect(parseBridgeMessage({ source: "vetta-generative-ui", kind: "scroll", top: "x", bottom: true })).toBeNull();
        expect(parseBridgeMessage({ source: "other", kind: "prompt", text: "x" })).toBeNull();
        expect(parseBridgeMessage({ source: "vetta-generative-ui", kind: "prompt", text: "  " })).toBeNull();
        expect(parseBridgeMessage({ source: "vetta-generative-ui", kind: "eval", code: "x" })).toBeNull();
    });
});

describe("visual answer guidance", () => {
    function provider() {
        let registered: { handler: (context: never) => unknown } | undefined;
        registerPromptProvider({ agent: { registerSystemPromptProvider: (value: never) => ((registered = value), { dispose() {} }) } } as never);
        return (scenario: string) => registered!.handler({ plugin: { id: "vetta-generative-ui" }, session: { scenario } } as never) as Array<{ block: { id: string; content: string } }>;
    }

    it("adds one plugin-owned block in chat scenarios and nothing elsewhere", () => {
        const run = provider();
        for (const scenario of ["conversation", "project"]) {
            expect(run(scenario)).toHaveLength(1);
            expect(run(scenario)[0]!.block).toMatchObject({ id: "plugin.vetta-generative-ui.visual-answers", content: VISUAL_ANSWER_GUIDANCE });
        }
        for (const scenario of ["automation", "batch", "im-claw", "cli"]) expect(run(scenario)).toEqual([]);
    });

    it("tells the model both when to use a view and when not to", () => {
        expect(VISUAL_ANSWER_GUIDANCE).toMatch(/Rust vs Go/);
        expect(VISUAL_ANSWER_GUIDANCE).toMatch(/Answer in plain text instead/);
        expect(VISUAL_ANSWER_GUIDANCE).toMatch(/ok:false/);
    });
});
