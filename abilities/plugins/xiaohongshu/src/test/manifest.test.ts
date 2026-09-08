import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../plugin.json";
import ability from "../../ability.json";

describe("packaged service contract", () => {
	it("uses a lightweight health endpoint independently of login readiness", () => {
		expect(manifest.providers.services[0].health).toMatchObject({
			path: "/health",
		});
		expect("readiness" in manifest.providers.services[0].health).toBe(false);
	});

	it("uses a visible browser for login compatibility", () => {
		expect(manifest.providers.services[0].process.args).toContain(
			"-headless=false",
		);
	});

	it("keeps catalog and package versions aligned and packaged details resolvable", () => {
		const catalog = JSON.parse(
			readFileSync(
				new URL("../../../../../.vetta/marketplace.json", import.meta.url),
				"utf8",
			),
		);
		expect(
			catalog.abilities.find(
				(item: { slug: string }) => item.slug === manifest.id,
			)?.version,
		).toBe(manifest.version);
		expect(ability.version).toBe(manifest.version);
		for (const path of [ability.detail.path, ability.detail.i18n.zh.path]) {
			expect(existsSync(new URL("../../" + path, import.meta.url))).toBe(true);
		}
	});
});
