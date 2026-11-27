import type { GenerationMetricsSnapshot, GenerationTurnMetrics } from "@vetta-org/plugin-sdk";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import { makeCall, makeSnapshot } from "./metrics-fixtures";

let snapshot: GenerationMetricsSnapshot = makeSnapshot();

vi.mock("@vetta-org/plugin-sdk", () => ({
	useGenerationMetrics: () => snapshot,
	useTranslation: () => ({
		locale: "en",
		t: (key: string, params?: Record<string, string | number>) =>
			((en as Record<string, string>)[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(params?.[name] ?? "")),
	}),
}));

const { TurnSpeedCard } = await import("../features/turn-summary/components/turn-speed-card");

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

afterEach(() => cleanup());

describe("turn speed card", () => {
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
		expect(dialog.textContent).toContain("Generation speed");
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
		await userEvent.click(screen.getByRole("button"));
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
