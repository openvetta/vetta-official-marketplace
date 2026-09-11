// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { XhsSetupSlot } from "../features/account-connection/components/xhs-setup-slot";
import { XhsAccountsView } from "../features/account-management/components/xhs-accounts-view";

const mocks = vi.hoisted(() => ({
	state: {
		schemaVersion: 1,
		activeAccountId: "account-a" as string | undefined,
		accounts: [
			{
				id: "account-a",
				name: "小红书账号 1",
				nickname: "花酒",
				avatarUrl: "https://sns-avatar.example/flower.webp",
				createdAt: "2026-01-01T00:00:00.000Z",
				lastCheckedAt: "2026-01-02T00:00:00.000Z",
				status: "connected" as const,
			},
		],
	},
	login: undefined as
		| { loggedIn: boolean; nickname?: string; userId?: string }
		| undefined,
}));

vi.mock("@vetta-org/plugin-sdk", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string | number>) => {
			const labels: Record<string, string> = {
				"setup.starting": "正在启动服务",
				"setup.connected": "已登录",
				"setup.notLoggedIn": "尚未登录",
				"setup.connectionTitle": "账号连接",
				"setup.connectedHint": "当前使用：{{name}}",
				"setup.identityPending": "账号身份待识别",
				"setup.identityPendingHint": "已登录，但上游暂未返回昵称",
				"setup.lastChecked": "最近验证：{{time}}",
				"setup.subtitle": "登录和账号会话由插件管理",
				"setup.login": "登录小红书",
				"setup.openAccounts": "管理多个账号",
				"setup.refresh": "刷新状态",
				"accounts.eyebrow": "ACCOUNT CENTER",
				"accounts.title": "小红书账号",
				"accounts.subtitle": "在这里管理小红书登录账号",
				"accounts.currentLabel": "当前账号",
				"accounts.active": "当前使用",
				"accounts.savedLabel": "已保存账号",
				"accounts.securityLabel": "会话存储",
				"accounts.localOnly": "仅本机",
				"accounts.securityHint": "登录会话由插件隔离保存",
				"accounts.savedHint": "可随时切换",
				"accounts.savedTitle": "已保存的账号",
				"accounts.savedSubtitle": "每个账号都有独立会话",
				"accounts.accountUnit": "个账号",
				"accounts.currentHint": "当前使用",
				"accounts.status.connected": "已连接",
				"accounts.created": "添加时间",
				"accounts.checked": "最近验证",
				"accounts.loginNew": "添加账号",
				"accounts.remove": "删除",
				"accounts.identityPending": "账号身份待识别",
				"accounts.statActive": "当前生效账号",
				"accounts.statService": "后台服务状态",
				"accounts.statSaved": "多账号池",
				"accounts.tagCurrent": "当前生效",
				"accounts.tagRuntime": "运行环境",
				"accounts.tagSecurity": "本地存储",
				"accounts.serviceDesc": "小红书 MCP 插件守护进程正常",
				"accounts.emptyTitle": "还没有连接账号",
				"accounts.emptyDesc":
					"连接小红书账号后，可以在会话中无缝使用小红书 MCP",
				"accounts.emptyCta": "添加第一个小红书账号",
				"accounts.renameTitle": "修改账号备注",
				"accounts.deleteTitle": "移除账号",
				"accounts.deleteWarning": "确定要移除账号“{{name}}”吗？",
				"accounts.cancel": "取消",
				"accounts.save": "保存",
			};
			return (labels[key] ?? key)
				.replace("{{name}}", String(params?.name ?? ""))
				.replace("{{time}}", String(params?.time ?? ""));
		},
	}),
}));

vi.mock("../runtime", () => ({
	ensureServiceStarted: vi.fn(async () => undefined),
}));
vi.mock("../xhs", async () => {
	const actual = await vi.importActual<typeof import("../xhs")>("../xhs");
	return {
		...actual,
		readAccountState: vi.fn(async () => mocks.state),
		loginStatus: vi.fn(async () => mocks.login),
		updateAccountIdentity: vi.fn(async () => mocks.state.accounts[0]),
	};
});

const context = {
	ui: { openWorkspaceView: vi.fn() },
	services: {},
	storage: {},
	secrets: {},
} as never;

describe("xiaohongshu plugin account UI", () => {
	afterEach(() => {
		cleanup();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.login = { loggedIn: true, nickname: "花酒", userId: "user-8023" };
	});

	it("translates the startup state instead of leaking an internal key", async () => {
		mocks.login = { loggedIn: false, nickname: undefined, userId: undefined };
		render(<XhsSetupSlot context={context} />);
		await waitFor(() => expect(screen.getByText("尚未登录")).toBeTruthy());
		expect(screen.queryByText("setup.starting")).toBeNull();
	});

	it("shows the real nickname in the connection card and workspace", async () => {
		mocks.login = { loggedIn: true, nickname: "花酒", userId: "user-8023" };
		render(<XhsAccountsView context={context} />);
		await waitFor(() =>
			expect(screen.getAllByText("花酒").length).toBeGreaterThanOrEqual(2),
		);
		expect(screen.getByText(/当前账号/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "删除" })).toBeTruthy();
		expect(
			Array.from(document.querySelectorAll("img")).some(
				(image) => image.getAttribute("src") === "https://sns-avatar.example/flower.webp",
			),
		).toBe(true);
		expect(document.body.textContent).not.toContain("📋");
		expect(document.body.textContent).not.toContain("✎");
		expect(
			Array.from(
				screen
					.getByRole("button", { name: "修改账号备注" })
					.querySelectorAll("span"),
			).some((element) =>
				String(element.className).includes("icon-[solar--pen-2-linear]"),
			),
		).toBe(true);
	});

	it("renders accounts in a responsive grid rather than a single-column full-width strip", async () => {
		render(<XhsAccountsView context={context} />);
		await waitFor(() => expect(screen.getByTestId("accounts-grid")).toBeTruthy());
		const grid = screen.getByTestId("accounts-grid");
		expect(grid.className).toContain("grid-cols-1");
		expect(grid.className).toContain("sm:grid-cols-2");
		expect(grid.className).toContain("lg:grid-cols-3");
		const card = grid.querySelector("article");
		expect(card?.className).toContain("flex-col");
		expect(card?.className).not.toContain("sm:flex-row");
	});

	it("keeps the account workspace scrollable when the account list overflows", async () => {
		render(<XhsAccountsView context={context} />);
		await waitFor(() => expect(screen.getByText("已保存的账号")).toBeTruthy());
		expect(document.querySelector("main")?.className).toContain("overflow-y-auto");
	});

	it("renders Chinese tags in summary cards instead of raw English", async () => {
		render(<XhsAccountsView context={context} />);
		await waitFor(() => expect(screen.getByText("当前生效")).toBeTruthy());
		expect(screen.getByText("运行环境")).toBeTruthy();
		expect(screen.getByText("本地存储")).toBeTruthy();
		expect(screen.queryByText("CURRENT")).toBeNull();
		expect(screen.queryByText("RUNTIME")).toBeNull();
		expect(screen.queryByText("SECURITY")).toBeNull();
	});

	it("keeps the three account summary cards in one row", async () => {
		render(<XhsAccountsView context={context} />);
		await waitFor(() => expect(screen.getByText("当前生效账号")).toBeTruthy());
		const summary = screen.getByTestId("account-summary-grid");
		expect(summary.className).toContain("grid-cols-3");
		expect(summary.className).not.toContain("grid-cols-1");
	});

	it("renders empty state when no accounts are saved", async () => {
		const originalAccounts = mocks.state.accounts;
		const originalActive = mocks.state.activeAccountId;
		mocks.state.accounts = [];
		mocks.state.activeAccountId = undefined;
		mocks.login = { loggedIn: false };
		try {
			render(<XhsAccountsView context={context} />);
			await waitFor(() =>
				expect(screen.getByText("还没有连接账号")).toBeTruthy(),
			);
			expect(screen.getByText("添加第一个小红书账号")).toBeTruthy();
		} finally {
			mocks.state.accounts = originalAccounts;
			mocks.state.activeAccountId = originalActive;
		}
	});

	it("opens delete confirm modal when clicking remove button", async () => {
		mocks.login = { loggedIn: true, nickname: "花酒", userId: "user-8023" };
		render(<XhsAccountsView context={context} />);
		await waitFor(() =>
			expect(
				screen.getAllByRole("button", { name: "删除" }).length,
			).toBeGreaterThan(0),
		);
		const deleteBtn = screen.getAllByRole("button", { name: "删除" })[0];
		deleteBtn.click();
		await waitFor(() => expect(screen.getByText("移除账号")).toBeTruthy());
		expect(screen.getByText(/确定要移除账号“花酒”吗？/)).toBeTruthy();
	});

	it("does not present an unverified avatar as the signed-in account", async () => {
		mocks.state.accounts = [{
			...mocks.state.accounts[0],
			nickname: "",
			avatarUrl: "https://sns-avatar.example/stale.webp",
		}];
		try {
			render(<XhsAccountsView context={context} />);
			await waitFor(() => expect(screen.getAllByText("账号身份待识别").length).toBeGreaterThan(0));
			expect(document.querySelector('img[src="https://sns-avatar.example/stale.webp"]')).toBeNull();
		} finally {
			mocks.state.accounts = [{
				...mocks.state.accounts[0],
				nickname: "花酒",
				avatarUrl: "https://sns-avatar.example/flower.webp",
			}];
		}
	});
});
