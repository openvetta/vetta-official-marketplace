import { describe, expect, it, vi } from "vitest";
import {
	renderQrCode,
	renderQrPayload,
} from "../features/account-connection/services/qr-code";
import {
	accountDisplayName,
	accountInitial,
	identityFromProfile,
	loginStatus,
	readAccountState,
	removeAccount,
	requestQrPayload,
	switchAccount,
	renameAccount,
	updateAccountIdentity,
} from "../xhs";
import { isAbortError } from "../shared/state/status";

function context() {
	const files = new Map<string, unknown>();
	const secrets = new Map<string, string>([
		[
			"session:account-a",
			JSON.stringify({ version: 2, seed: "seed-a", cookies: [{ name: "a" }] }),
		],
	]);
	const service = {
		stop: vi.fn(async () => ({ phase: "stopped" })),
		start: vi.fn(async () => ({ phase: "starting" })),
		writeDataFile: vi.fn(
			async (_service: string, _path: string, data: string) => {
				files.set("cookies.json", JSON.parse(data));
			},
		),
		readDataFile: vi.fn(async () => JSON.stringify(files.get("cookies.json"))),
		request: vi.fn(async () => ({
			ok: true,
			status: 200,
			statusText: "OK",
			body: { data: { is_logged_in: true } },
		})),
	};
	const ctx = {
		storage: {
			readFile: vi.fn(async (path: string) => {
				const value = files.get(path);
				return value === undefined ? null : JSON.stringify(value);
			}),
			writeFile: vi.fn(async (path: string, value: string) => {
				files.set(path, JSON.parse(value));
			}),
		},
		secrets: {
			get: vi.fn(async (key: string) => secrets.get(key)),
			set: vi.fn(async (key: string, value: string) => {
				secrets.set(key, value);
			}),
			delete: vi.fn(async (key: string) => {
				secrets.delete(key);
			}),
		},
		services: service,
	} as never;
	files.set("accounts.json", {
		schemaVersion: 1,
		activeAccountId: "account-b",
		accounts: [
			{
				id: "account-a",
				name: "账号 A",
				createdAt: "2026-01-01",
				status: "connected",
			},
			{
				id: "account-b",
				name: "账号 B",
				createdAt: "2026-01-02",
				status: "unknown",
			},
		],
	});
	return { ctx, service, secrets };
}

describe("xiaohongshu plugin account handling", () => {
	it("treats service aborts during plugin reload as transient lifecycle events", () => {
		expect(
			isAbortError(new DOMException("The operation was aborted", "AbortError")),
		).toBe(true);
		expect(isAbortError({ name: "AbortError" })).toBe(true);
		expect(isAbortError(new Error("network request failed"))).toBe(false);
	});

	it("renders QR codes inside the plugin without a host QR API", async () => {
		expect(await renderQrCode("https://example.test/login")).toMatch(
			/^data:image\/png;base64,/,
		);
	});

	it("keeps an upstream QR image data URL intact", async () => {
		const image = "data:image/png;base64,ZmFrZQ==";
		await expect(renderQrPayload(image)).resolves.toBe(image);
	});

	it("accepts the upstream login status and QR image response shapes", async () => {
		const { ctx, service } = context();
		service.request
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
				body: { data: { is_logged_in: false } },
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
				body: { qrCode: "data:image/png;base64,ZmFrZQ==" },
			} as never);
		await expect(loginStatus(ctx)).resolves.toMatchObject({ loggedIn: false });
		await expect(requestQrPayload(ctx)).resolves.toBe(
			"data:image/png;base64,ZmFrZQ==",
		);
	});

	it("surfaces the managed service error when QR generation is blocked", async () => {
		const { ctx, service } = context();
		service.request.mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: "Internal Server Error",
			body: {
				error: "小红书未返回二维码：安全限制 IP存在风险，请切换可靠网络环境后重试 300012",
			},
		} as never);

		await expect(requestQrPayload(ctx)).rejects.toThrow(
			"二维码获取失败：小红书未返回二维码：安全限制 IP存在风险",
		);
	});

	it("reads the identity fields returned by the managed upstream runtime", async () => {
		const { ctx, service } = context();
		service.request.mockResolvedValueOnce({
			ok: true,
			status: 200,
			statusText: "OK",
			body: {
				data: {
					is_logged_in: true,
					username: "花酒",
					user_id: "user-8023",
				},
			},
		} as never);

		await expect(loginStatus(ctx)).resolves.toEqual({
			loggedIn: true,
			nickname: "花酒",
			userId: "user-8023",
		});
	});

	it("falls back to the current-profile endpoint when login status has no nickname", async () => {
		const { ctx, service } = context();
		service.request
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
				body: { data: { is_logged_in: true } },
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
				body: {
					data: {
						data: {
							basicInfo: {
								nickname: "花酒",
								userId: "user-8023",
							},
						},
					},
				},
			} as never);

		await expect(loginStatus(ctx)).resolves.toEqual({
			loggedIn: true,
			nickname: "花酒",
			userId: "user-8023",
		});
		expect(service.request).toHaveBeenNthCalledWith(
			2,
			"xhs",
			expect.objectContaining({ path: "/api/v1/user/me" }),
		);
	});

	it("keeps a valid login when profile enrichment is temporarily unavailable", async () => {
		const { ctx, service } = context();
		service.request
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
				body: { data: { is_logged_in: true, user_id: "user-8023" } },
			} as never)
			.mockRejectedValueOnce(new Error("profile timed out"));

		await expect(loginStatus(ctx)).resolves.toEqual({
			loggedIn: true,
			nickname: undefined,
			userId: "user-8023",
		});
	});

	it("parses nested upstream profile identities without trusting unrelated fields", () => {
		expect(
			identityFromProfile({
				data: { data: { basicInfo: { nickname: " 花酒 ", redId: "8023", avatar: "https://img.example/avatar.png" } } },
				message: "ignored",
			}),
		).toEqual({ nickname: "花酒", userId: "8023", avatarUrl: "https://img.example/avatar.png" });
	});

	it("does not present generated storage labels as a known account identity", () => {
		expect(accountDisplayName({ name: "小红书账号 1" })).toBeUndefined();
		expect(accountDisplayName({ name: "小红书账号 1", nickname: "花酒" })).toBe(
			"花酒",
		);
		expect(accountDisplayName({ name: "扫码流程验证号", nickname: "花酒" })).toBe(
			"花酒",
		);
		expect(accountInitial({ name: "小红书账号 1", nickname: "花酒" })).toBe(
			"花",
		);
	});

	it("marks the active saved account expired when the service is signed out", async () => {
		const { ctx } = context();
		const updated = await updateAccountIdentity(ctx, "account-b", {
			loggedIn: false,
		});

		expect(updated?.status).toBe("expired");
		expect(
			(await readAccountState(ctx)).accounts.find(
				(account) => account.id === "account-b",
			)?.status,
		).toBe("expired");
	});

	it("writes the complete opaque session before restarting and activating it", async () => {
		const { ctx, service } = context();
		await switchAccount(ctx, "account-a");
		expect(service.stop).toHaveBeenCalledBefore(service.writeDataFile);
		expect(service.writeDataFile.mock.calls[0]?.[2]).toContain(
			'"seed":"seed-a"',
		);
		expect(service.start).toHaveBeenCalledAfter(service.writeDataFile);
		expect(service.request).toHaveBeenCalledWith(
			"xhs",
			expect.objectContaining({
				path: "/api/v1/accounts/account-a/activate",
				method: "POST",
			}),
		);
		expect(await readAccountState(ctx)).toMatchObject({
			activeAccountId: "account-a",
		});
	});

	it("switches a service-owned account when no legacy secret exists", async () => {
		const { ctx, service } = context();
		await switchAccount(ctx, "account-b");
		expect(service.writeDataFile).not.toHaveBeenCalled();
		expect(await readAccountState(ctx)).toMatchObject({
			activeAccountId: "account-b",
		});
	});

	it("shows a custom account note before the upstream nickname", () => {
		expect(accountDisplayName({ name: "我的主号", nickname: "花酒" })).toBe(
			"我的主号",
		);
	});

	it("updates account custom name via renameAccount", async () => {
		const { ctx } = context();
		const updated = await renameAccount(ctx, "account-a", "我的小红书主号");
		expect(updated?.name).toBe("我的小红书主号");
		const state = await readAccountState(ctx);
		expect(state.accounts.find((item) => item.id === "account-a")?.name).toBe(
			"我的小红书主号",
		);
	});

	it("removes the service account before deleting the local secret", async () => {
		const { ctx, service, secrets } = context();
		await removeAccount(ctx, "account-a");
		expect(service.request).toHaveBeenCalledWith(
			"xhs",
			expect.objectContaining({
				path: "/api/v1/accounts/account-a",
				method: "DELETE",
			}),
		);
		expect(secrets.has("session:account-a")).toBe(false);
		expect((await readAccountState(ctx)).accounts.map((account) => account.id)).toEqual(["account-b"]);
	});
});
