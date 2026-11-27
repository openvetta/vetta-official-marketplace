import type { GenerationCallMetrics, GenerationMetricsSnapshot } from "@vetta-org/plugin-sdk";

export function makeCall(overrides: Partial<GenerationCallMetrics> = {}): GenerationCallMetrics {
	return {
		turnId: "turn-1",
		modelCallIndex: 0,
		model: { provider: "anthropic", id: "claude-opus-5-5" },
		status: "done",
		requestedAt: 1000,
		firstTokenAt: 1400,
		lastTokenAt: 5400,
		endedAt: 5400,
		timeToFirstTokenMs: 400,
		outputTokens: 480,
		tokensPerSecond: 120,
		recentTokensPerSecond: null,
		estimated: false,
		usage: { input: 2000, output: 480, cacheRead: 1500, cacheWrite: 0 },
		...overrides,
	};
}

export function makeSnapshot(overrides: Partial<GenerationMetricsSnapshot> = {}): GenerationMetricsSnapshot {
	return { supported: true, sampledAt: 6000, sessionId: "s1", phase: "idle", call: makeCall(), turn: null, ...overrides };
}
