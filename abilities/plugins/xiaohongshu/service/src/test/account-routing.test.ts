import { describe, expect, it } from "vitest";
import {
	accountIdFromArgs,
	resolveAccount,
	withAccountSelector,
	type McpToolSchema,
} from "../mcp/account-routing.js";

const accounts = new Map([
	["account-a", { id: "account-a", name: "账号 A" }],
	["account-b", { id: "account-b", name: "账号 B" }],
]);

describe("MCP account routing", () => {
	it("routes an explicitly selected account without changing the active account", async () => {
		await expect(resolveAccount(
			{ account_id: "account-b" },
			"account-a",
			async (id) => accounts.get(id),
		)).resolves.toMatchObject({ id: "account-b" });
	});

	it("keeps the active account as the backwards-compatible default", async () => {
		await expect(resolveAccount(
			{},
			"account-a",
			async (id) => accounts.get(id),
		)).resolves.toMatchObject({ id: "account-a" });
	});

	it("rejects invalid and unknown account selectors", async () => {
		expect(() => accountIdFromArgs({ account_id: "  " })).toThrow("非空字符串");
		await expect(resolveAccount(
			{ account_id: "missing" },
			"account-a",
			async (id) => accounts.get(id),
		)).rejects.toThrow("小红书账号不存在：missing");
	});

	it("advertises account_id only for account-scoped tools", () => {
		const scoped: McpToolSchema = {
			name: "search_feeds",
			description: "搜索",
			inputSchema: { type: "object", properties: { keyword: { type: "string" } }, required: ["keyword"] },
		};
		const globalTool: McpToolSchema = {
			name: "xiaohongshu_list_accounts",
			description: "列表",
			inputSchema: { type: "object", properties: {} },
		};
		expect(withAccountSelector(scoped).inputSchema.properties).toHaveProperty("account_id");
		expect(withAccountSelector(scoped).inputSchema.required).toEqual(["keyword"]);
		expect(withAccountSelector(globalTool)).toBe(globalTool);
	});
});
