import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createAccountStore, type AccountMetadata } from "./accounts/account-store.js";
import { BrowserManager } from "./browser/browser-manager.js";

const port = Number(process.env.VETTA_SERVICE_PORT ?? 0);
const dataRoot = process.env.VETTA_SERVICE_DATA_DIR ?? "./service-data";
const store = createAccountStore(dataRoot);
const browser = new BrowserManager(store, dataRoot);
const sessions = new Map<string, { page: import("playwright-core").Page; context: import("playwright-core").BrowserContext; createdAt: number; accountId?: string }>();
let activeAccountId: string | undefined;

function json(response: ServerResponse, status: number, body: unknown): void {
	response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.from(chunk));
	if (chunks.length === 0) return {};
	const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
	const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
	if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { status: "ok", service: "xiaohongshu" });
	if (request.method === "GET" && url.pathname === "/api/v1/accounts") return json(response, 200, { accounts: await store.list(), activeAccountId });
	if (request.method === "GET" && url.pathname === "/api/v1/accounts/active") return json(response, 200, { account: activeAccountId ? await store.get(activeAccountId) : undefined });
	if (request.method === "POST" && url.pathname === "/api/v1/login/sessions") {
		const input = await body(request);
		const sessionId = randomUUID();
		const login = await browser.createLoginSession();
		sessions.set(sessionId, { ...login, createdAt: Date.now(), accountId: typeof input.accountId === "string" ? input.accountId : undefined });
		const qr = await login.page.locator("img").first().getAttribute("src").catch(() => null);
		return json(response, 201, { id: sessionId, accountId: typeof input.accountId === "string" ? input.accountId : undefined, status: "waiting", qrCode: qr, expiresAt: Date.now() + 180_000 });
	}
	const sessionMatch = url.pathname.match(/^\/api\/v1\/login\/sessions\/([^/]+)$/u);
	if (request.method === "GET" && sessionMatch) {
		const session = sessions.get(sessionMatch[1]);
		if (!session) return json(response, 404, { error: "login session not found" });
		const cookies = await session.context.cookies("https://www.xiaohongshu.com");
		if (cookies.length === 0 && Date.now() - session.createdAt < 180_000) return json(response, 200, { id: sessionMatch[1], status: "waiting" });
		const accountId = session.accountId ?? `account-${Date.now().toString(36)}`;
		const account: AccountMetadata = { id: accountId, name: "小红书账号", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
		await store.upsert(account);
		await browser.persist(accountId, session.context);
		activeAccountId = accountId;
		await session.context.close();
		sessions.delete(sessionMatch[1]);
		return json(response, 200, { id: sessionMatch[1], status: "authenticated", account });
	}
	const activateMatch = url.pathname.match(/^\/api\/v1\/accounts\/([^/]+)\/activate$/u);
	if (request.method === "POST" && activateMatch) {
		const account = await store.get(activateMatch[1]);
		if (!account) return json(response, 404, { error: "account not found" });
		activeAccountId = account.id;
		return json(response, 200, { account });
	}
	const accountMatch = url.pathname.match(/^\/api\/v1\/accounts\/([^/]+)$/u);
	if (request.method === "DELETE" && accountMatch) {
		await store.remove(accountMatch[1]);
		if (activeAccountId === accountMatch[1]) activeAccountId = undefined;
		return json(response, 204, undefined);
	}
	if (request.method === "POST" && url.pathname === "/mcp") {
		const rpc = await body(request);
		const id = rpc.id ?? null;
		if (rpc.method === "initialize") return json(response, 200, { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "xiaohongshu", version: "1.1.1" } } });
		if (rpc.method === "tools/list") return json(response, 200, { jsonrpc: "2.0", id, result: { tools: [
			{ name: "xiaohongshu_list_accounts", description: "List locally managed Xiaohongshu accounts.", inputSchema: { type: "object", properties: {} } },
			{ name: "xiaohongshu_active_account", description: "Get the active Xiaohongshu account.", inputSchema: { type: "object", properties: {} } },
		] } });
		if (rpc.method === "tools/call") {
			const params = rpc.params as Record<string, unknown> | undefined;
			const name = params?.name;
			if (name === "xiaohongshu_list_accounts") return json(response, 200, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ accounts: await store.list(), activeAccountId }) }] } });
			if (name === "xiaohongshu_active_account") return json(response, 200, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ account: activeAccountId ? await store.get(activeAccountId) : undefined }) }] } });
			return json(response, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: "Unknown tool" } });
		}
		return json(response, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: "Unsupported MCP method" } });
	}
	json(response, 404, { error: "not found" });
}

await mkdir(dataRoot, { recursive: true });
const server = createServer((request, response) => void route(request, response).catch((error: unknown) => json(response, 500, { error: error instanceof Error ? error.message : String(error) })));
server.listen(port, "127.0.0.1", () => process.stdout.write(`ready:${(server.address() as { port: number }).port}\n`));
const shutdown = () => void browser.close().finally(() => server.close());
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
