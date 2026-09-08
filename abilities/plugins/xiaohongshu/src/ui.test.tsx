// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { XhsAccountsView, XhsSetupSlot } from "./ui";

const mocks = vi.hoisted(() => ({
  state: {
    schemaVersion: 1,
    activeAccountId: "account-a",
    accounts: [
      {
        id: "account-a",
        name: "小红书账号 1",
        nickname: "花酒",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastCheckedAt: "2026-01-02T00:00:00.000Z",
        status: "connected" as const,
      },
    ],
  },
  login: undefined as
    { loggedIn: boolean; nickname?: string; userId?: string } | undefined,
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
      };
      return (labels[key] ?? key)
        .replace("{{name}}", String(params?.name ?? ""))
        .replace("{{time}}", String(params?.time ?? ""));
    },
  }),
}));

vi.mock("./runtime", () => ({
  ensureServiceStarted: vi.fn(async () => undefined),
}));
vi.mock("./xhs", async () => {
  const actual = await vi.importActual<typeof import("./xhs")>("./xhs");
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
  });
});
