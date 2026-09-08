export type UiStatus =
	| "starting"
	| "notLoggedIn"
	| "waitingQr"
	| "waitingScan"
	| "verifying"
	| "connected"
	| "failed";

export type Translation = (
	key: string,
	params?: Record<string, string | number>,
) => string;

export const PRIMARY_BUTTON =
	"inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition-all hover:from-rose-600 hover:to-red-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50";

export const SECONDARY_BUTTON =
	"inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3.5 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted/60 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50";

export const STATUS_META: Record<
	UiStatus,
	{ tone: string; dot: string; key: string }
> = {
	starting: {
		tone: "text-muted-foreground",
		dot: "bg-muted-foreground",
		key: "starting",
	},
	notLoggedIn: {
		tone: "text-amber-300",
		dot: "bg-amber-300",
		key: "notLoggedIn",
	},
	waitingQr: { tone: "text-sky-300", dot: "bg-sky-300", key: "waitingQr" },
	waitingScan: { tone: "text-sky-300", dot: "bg-sky-300", key: "waitingScan" },
	verifying: { tone: "text-sky-300", dot: "bg-sky-300", key: "verifying" },
	connected: {
		tone: "text-emerald-300",
		dot: "bg-emerald-400 animate-pulse",
		key: "connected",
	},
	failed: {
		tone: "text-destructive",
		dot: "bg-destructive",
		key: "failedStatus",
	},
};

export const STATUS_FALLBACKS: Record<UiStatus, string> = {
	starting: "正在启动服务",
	notLoggedIn: "尚未登录",
	waitingQr: "正在获取二维码…",
	waitingScan: "等待扫码",
	verifying: "正在验证登录…",
	connected: "已登录",
	failed: "操作失败",
};

export function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function isAbortError(error: unknown): boolean {
	if (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		(error as { name?: unknown }).name === "AbortError"
	)
		return true;
	return messageOf(error).toLowerCase().includes("operation was aborted");
}

export function errorText(
	t: Translation,
	key: string,
	details: string,
): string {
	return t(key, { details }).replaceAll("{{details}}", details);
}

export function formatAccountDate(
	value: string | undefined,
	locale: string,
): string | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return undefined;
	return new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}
