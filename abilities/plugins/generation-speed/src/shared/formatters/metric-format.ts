/** 速度读数：`≈123 tok/s`；没有值时为 `—`。 */
export function formatSpeed(tokensPerSecond: number | null, approximate: boolean): string {
	if (tokensPerSecond === null || !Number.isFinite(tokensPerSecond)) return "—";
	const value =
		tokensPerSecond >= 100 || tokensPerSecond === 0 ? Math.round(tokensPerSecond).toString() : tokensPerSecond.toFixed(1);
	return `${approximate ? "≈" : ""}${value} tok/s`;
}

/** 时长：小于 1 秒用 ms，否则保留一位小数的秒。 */
export function formatDuration(ms: number | null): string {
	if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
	if (ms < 1000) return `${Math.round(ms)} ms`;
	return `${(ms / 1000).toFixed(1)} s`;
}

/** token 数：千位以上用 k。 */
export function formatTokens(tokens: number | null, approximate = false): string {
	if (tokens === null || !Number.isFinite(tokens)) return "—";
	const text = tokens >= 10_000 ? `${(tokens / 1000).toFixed(1)}k` : Math.round(tokens).toLocaleString("en-US");
	return `${approximate ? "≈" : ""}${text}`;
}
