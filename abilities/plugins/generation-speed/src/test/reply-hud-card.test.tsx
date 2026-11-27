import type { ConversationMessage, GenerationMetricsSnapshot, GenerationTurnMetrics, PluginContext } from "@vetta-org/plugin-sdk";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import { makeCall, makeSnapshot } from "./metrics-fixtures";

let snapshot: GenerationMetricsSnapshot = makeSnapshot();
let messages: ConversationMessage[] = [];

vi.mock("@vetta-org/plugin-sdk", () => ({
	useGenerationMetrics: () => snapshot,
	useConversationMessages: () => messages,
	useTranslation: () => ({
		locale: "en",
		t: (key: string, params?: Record<string, string | number>) =>
			((en as Record<string, string>)[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(params?.[name] ?? "")),
	}),
}));

const { ReplyHudCard: TurnSpeedCard } = await import("../features/turn-summary/components/reply-hud-card");
const { fetchedPagesStore } = await import("../features/turn-sources/services/fetched-pages-store");
const { setPluginContext } = await import("../plugin-context");

const { clearFaviconCache } = await import("../features/turn-sources/services/favicon-resolver");

const openExternal = vi.fn(async (_url: string) => {});
/** 只有 react.dev 声明了图标；其余站点的请求都失败。 */
const networkRequest = vi.fn(async (request: { url: string; responseType?: string }) => {
	if (request.url === "https://react.dev") {
		return { ok: true, status: 200, statusText: "OK", headers: { "Content-Type": "text/html" }, body: '<link rel="icon" href="/icon.png">' };
	}
	if (request.url === "https://react.dev/icon.png") {
		return { ok: true, status: 200, statusText: "OK", headers: { "content-type": "image/png" }, body: "iVBORw0KGgo=" };
	}
	throw new Error("offline");
});
setPluginContext({ ui: { openExternal }, network: { request: networkRequest } } as unknown as PluginContext);

function makeTurn(overrides: Partial<GenerationTurnMetrics> = {}): GenerationTurnMetrics {
	return {
		turnId: "turn-1",
		startedAt: 900,
		endedAt: 9000,
		status: "completed",
		modelCalls: 2,
		outputTokens: 900,
		generationMs: 8000,
		tokensPerSecond: 112.5,
		estimated: false,
		...overrides,
	};
}

afterEach(() => {
	cleanup();
	messages = [];
	openExternal.mockClear();
	clearFaviconCache();
	fetchedPagesStore.handle({ type: "message-added", message: { id: "reset", role: "user", text: "" } });
});

fetchedPagesStore.handle({ type: "conversation-changed", conversation: { id: "s1" } as never });

describe("reply HUD card: speed row", () => {
	it("shows the live speed and phase while the turn is generating", () => {
		snapshot = makeSnapshot({
			phase: "text",
			call: makeCall({ status: "streaming", recentTokensPerSecond: 123, estimated: true, endedAt: null }),
			turn: makeTurn({ status: "running", endedAt: null, modelCalls: 1, outputTokens: 300, estimated: true }),
		});
		render(<TurnSpeedCard />);
		expect(screen.getByText("≈123 tok/s")).toBeTruthy();
		expect(screen.getByText("Writing the reply")).toBeTruthy();
		expect(screen.getByRole("button").textContent).toContain("first token 400 ms · ≈300 output tokens");
	});

	it("settles on the turn average with real tokens after the turn completes", () => {
		snapshot = makeSnapshot({ turn: makeTurn() });
		render(<TurnSpeedCard />);
		expect(screen.getByText("113 tok/s")).toBeTruthy();
		expect(screen.getByRole("button").textContent).toContain("900 output tokens · 2 model calls · claude-opus-5-5");
		expect(screen.queryByText("Idle")).toBeNull();
	});

	it("stays hidden without metrics or before any generation", () => {
		snapshot = makeSnapshot({ supported: false, call: null });
		const { container, rerender } = render(<TurnSpeedCard />);
		expect(container.textContent).toBe("");
		snapshot = makeSnapshot({ call: null });
		rerender(<TurnSpeedCard />);
		expect(container.textContent).toBe("");
	});

	it("opens a details dialog with the turn summary, usage and model when clicked", async () => {
		snapshot = makeSnapshot({ turn: makeTurn() });
		render(<TurnSpeedCard />);
		await userEvent.click(screen.getByRole("button", { name: /113 tok\/s/ }));

		const dialog = await screen.findByRole("dialog");
		expect(dialog.textContent).toContain("Reply details");
		expect(dialog.textContent).toContain("Turn completed");
		expect(dialog.textContent).toContain("Average of this turn");
		expect(dialog.textContent).toContain("First-token latency400 ms");
		expect(dialog.textContent).toContain("Model calls this turn2");
		expect(dialog.textContent).toContain("Cache read1,500");
		expect(dialog.textContent).toContain("Model: claude-opus-5-5");
		// 没有走势数据时保留占位，布局不因数据到来而变化。
		expect(dialog.textContent).toContain("Shows up while the model is generating");
	});

	it("keeps the usage section in place with dashes while the provider has not reported usage", async () => {
		snapshot = makeSnapshot({ call: makeCall({ usage: null }), turn: makeTurn() });
		render(<TurnSpeedCard />);
		await userEvent.click(screen.getByRole("button", { name: /113 tok\/s/ }));
		const dialog = await screen.findByRole("dialog");
		expect(dialog.textContent).toContain("Token usage of the last call");
		expect(dialog.textContent).toContain("Cache read—");
	});

	it("draws the live speed trend in the dialog while generating", async () => {
		const streaming = (sampledAt: number, value: number) =>
			makeSnapshot({
				sampledAt,
				phase: "text",
				call: makeCall({ status: "streaming", recentTokensPerSecond: value, estimated: true, endedAt: null, usage: null }),
				turn: makeTurn({ status: "running", endedAt: null }),
			});
		snapshot = streaming(1000, 80);
		const { rerender } = render(<TurnSpeedCard />);
		for (const [at, value] of [[1250, 95], [1500, 120]] as const) {
			snapshot = streaming(at, value);
			act(() => rerender(<TurnSpeedCard />));
		}
		await userEvent.click(screen.getByRole("button", { name: /≈120 tok\/s/ }));

		const dialog = await screen.findByRole("dialog");
		expect(dialog.textContent).toContain("Live speed · last 2 seconds");
		expect(screen.getByRole("img", { name: "Live speed during this turn" }).querySelector("polyline")?.getAttribute("points")?.split(" ")).toHaveLength(3);
	});
});

describe("reply HUD card: sources row", () => {
	const reply = (text: string): ConversationMessage[] => [
		{ id: "u1", role: "user", text: "Compare the two libraries." },
		{ id: "a1", role: "assistant", text },
	];

	it("lists cited links and pages the tools opened as domain chips that open in the browser", async () => {
		snapshot = makeSnapshot({ supported: false, call: null });
		messages = reply("See [React docs](https://react.dev/learn) and https://www.vuejs.org/guide.");
		fetchedPagesStore.handle({ type: "tool-call-start", toolCallId: "t1", toolName: "web_fetch", args: { url: "https://svelte.dev/docs" } });
		render(<TurnSpeedCard />);

		expect(screen.getByRole("button", { name: "react.dev" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "vuejs.org" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "svelte.dev" })).toBeTruthy();
		await userEvent.click(screen.getByRole("button", { name: "react.dev" }));
		expect(openExternal).toHaveBeenCalledWith("https://react.dev/learn");
	});

	it("opens the sources tab with titles, origins and a Markdown copy", async () => {
		snapshot = makeSnapshot();
		messages = reply("Per [React docs](https://react.dev/learn).");
		fetchedPagesStore.handle({ type: "tool-call-start", toolCallId: "t2", toolName: "web_fetch", args: { url: "https://svelte.dev/docs" } });
		const writeText = vi.fn(async (_text: string) => {});
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		render(<TurnSpeedCard />);

		await userEvent.click(screen.getByRole("button", { name: "All 2 sources" }));
		const dialog = await screen.findByRole("dialog");
		expect(screen.getByRole("tab", { name: "Sources 2" }).getAttribute("aria-selected")).toBe("true");
		expect(dialog.textContent).toContain("React docs");
		expect(dialog.textContent).toContain("Cited");
		expect(dialog.textContent).toContain("Opened by tool");

		await userEvent.click(screen.getByRole("button", { name: "Copy as Markdown" }));
		expect(writeText).toHaveBeenCalledWith("1. [React docs](https://react.dev/learn)\n2. [svelte.dev](https://svelte.dev/docs)");
		expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();

		await userEvent.click(screen.getByRole("tab", { name: "Speed" }));
		expect(dialog.textContent).toContain("First-token latency");
	});

	it("collapses more than three sources into the sites' own icons and a summary that opens the sources tab", async () => {
		snapshot = makeSnapshot({ supported: false, call: null });
		messages = reply("See https://www.react.dev/a, https://vuejs.org/b, https://svelte.dev/c and https://react.dev/d.");
		fetchedPagesStore.handle({ type: "tool-call-start", toolCallId: "t4", toolName: "web_fetch", args: { url: "https://solidjs.com" } });
		const { container } = render(<TurnSpeedCard />);

		expect(screen.queryByText("vuejs.org")).toBeNull();
		// 同一站点只出一个图标，最多叠 3 个；react.dev 用它自己声明的图标，取不到的显示首字母。
		expect(screen.getAllByRole("button", { name: /^(react\.dev|vuejs\.org|svelte\.dev)$/ })).toHaveLength(3);
		await screen.findByText("v");
		expect(container.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,iVBORw0KGgo=");

		await userEvent.click(screen.getByRole("button", { name: "vuejs.org" }));
		expect(openExternal).toHaveBeenCalledWith("https://vuejs.org/b");

		await userEvent.click(screen.getByRole("button", { name: "react.dev and 5 sources in total" }));
		await screen.findByRole("dialog");
		expect(screen.getByRole("tab", { name: "Sources 5" }).getAttribute("aria-selected")).toBe("true");
	});

	it("hides the row when the reply has no sources and drops pages whose fetch failed", () => {
		snapshot = makeSnapshot({ supported: false, call: null });
		messages = reply("No links here, only `https://example.com/in-code`.");
		fetchedPagesStore.handle({ type: "tool-call-start", toolCallId: "t3", toolName: "web_fetch", args: { url: "https://down.example" } });
		fetchedPagesStore.handle({ type: "tool-call-end", toolCallId: "t3", toolName: "web_fetch", isError: true });
		const { container } = render(<TurnSpeedCard />);
		expect(container.textContent).toBe("");
	});
});
