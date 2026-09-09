export type McpToolSchema = {
	name: string;
	description: string;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
};

/** Tools whose work is executed inside a specific Xiaohongshu account session. */
export const ACCOUNT_SCOPED_TOOL_NAMES = new Set([
	"publish_content",
	"publish_with_video",
	"check_login_status",
	"list_feeds",
	"search_feeds",
	"get_feed_detail",
	"user_profile",
	"get_my_profile",
	"post_comment_to_feed",
	"reply_comment_in_feed",
	"like_feed",
	"favorite_feed",
	"like_notification",
	"reply_notification",
	"get_unread_count",
	"list_notifications",
]);

const ACCOUNT_SELECTOR_PROPERTY = {
	type: "string",
	description: "目标账号 ID；省略时使用当前活跃账号。",
};

/** Add the optional account selector without changing existing tool arguments. */
export function withAccountSelector<T extends McpToolSchema>(tool: T): T {
	if (!ACCOUNT_SCOPED_TOOL_NAMES.has(tool.name)) return tool;
	return {
		...tool,
		inputSchema: {
			...tool.inputSchema,
			properties: {
				account_id: ACCOUNT_SELECTOR_PROPERTY,
				...tool.inputSchema.properties,
			},
		},
	};
}

export function accountIdFromArgs(args: Record<string, unknown>): string | undefined {
	const value = args.account_id;
	if (value === undefined) return undefined;
	if (typeof value !== "string" || !value.trim()) {
		throw new Error("account_id 必须是非空字符串");
	}
	return value.trim();
}

export async function resolveAccount<T extends { id: string }>(
	args: Record<string, unknown>,
	activeAccountId: string | undefined,
	getAccount: (id: string) => Promise<T | undefined>,
): Promise<T> {
	const requestedAccountId = accountIdFromArgs(args);
	const accountId = requestedAccountId ?? activeAccountId;
	if (!accountId) throw new Error("当前没有激活的小红书账号，请指定 account_id");
	const account = await getAccount(accountId);
	if (!account) {
		throw new Error(
			requestedAccountId
				? `小红书账号不存在：${requestedAccountId}`
				: "当前激活账号不存在",
		);
	}
	return account;
}
