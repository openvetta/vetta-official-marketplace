import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface Manifest {
	id: string;
	permissions: string[];
	commands?: string[];
	agent?: { skillPaths?: string[] };
}

async function readManifest(): Promise<Manifest> {
	return JSON.parse(await readFile(resolve(import.meta.dirname, "../plugin.json"), "utf8")) as Manifest;
}

describe("Build Apple Apps plugin manifest", () => {
	it("keeps the manifest id equal to the directory name", async () => {
		// 市场条目的 slug 与插件 id 必须一致，否则整源校验失败。
		const manifest = await readManifest();
		expect(manifest.id).toBe("build-apple-apps");
	});

	it("only drives the one executable the panel spawns", async () => {
		// 用户安装时要逐项授权，命令面必须保持最小。Skill 里的
		// xcrun/xcodebuild 走 Agent 自己的 shell，不经过插件的 commands 白名单。
		const manifest = await readManifest();
		expect(manifest.commands).toEqual(["baguette"]);
	});

	it("requests the panel, command and skill permissions it uses", async () => {
		const manifest = await readManifest();
		expect(manifest.permissions).toEqual(
			expect.arrayContaining([
				"ui.slot.activity-tab",
				"ui.slot.workspace-view",
				"agent.command.run",
				"agent.command.spawn",
				"agent.skills.control",
				"fs.read",
				"storage.read",
				"storage.write",
			]),
		);
	});

	it("contributes no Agent Tool and writes nothing outside its own storage", async () => {
		// Agent 侧走 Skill + CLI，不注册工具；面板只读目录做显隐判定，不写用户文件。
		// storage.write 只用于插件自己的配置（见 panel-settings）。
		const manifest = await readManifest();
		expect(manifest.permissions).not.toEqual(
			expect.arrayContaining([
				"agent.tools.register",
				"agent.toolHandler.execute",
				"agent.session.write",
				"fs.write",
				"network.fetch",
			]),
		);
	});

	it("ships the agent skill", async () => {
		const manifest = await readManifest();
		expect(manifest.agent?.skillPaths).toEqual(["agent/skills/vetta-apple-app-dev-guide"]);
	});
});
