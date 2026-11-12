import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const plugin = JSON.parse(readFileSync(resolve(root, "plugin.json"), "utf8"));

describe("ego manifest", () => {
	it("points every agent contribution at a real file", () => {
		for (const path of [
			...plugin.agent.systemPrompt.promptPaths,
			...plugin.agent.skillPaths,
		]) {
			expect(existsSync(resolve(root, path)), path).toBe(true);
		}
		expect(existsSync(resolve(root, plugin.agent.skillPaths[0], "SKILL.md"))).toBe(true);
	});

	it("requests only the permissions its contributions need", () => {
		expect([...plugin.permissions].sort()).toEqual(["agent.skills.control", "agent.systemPrompt.write"]);
	});

	it("keeps the bundled skill name aligned with its presentation entry", () => {
		const skill = readFileSync(resolve(root, "agent/skills/ego-browser/SKILL.md"), "utf8");
		expect(skill).toMatch(/^name: ego-browser$/m);
		expect(plugin.agent.skillPresentation.skills["ego-browser"]).toBeDefined();
	});

	it("tells the agent when not to use ego", () => {
		const prompt = readFileSync(resolve(root, "agent/prompts/prefer-ego-browser.md"), "utf8");
		expect(prompt).toContain("`ego-browser` skill");
		expect(prompt).toMatch(/does not apply/);
	});
});
