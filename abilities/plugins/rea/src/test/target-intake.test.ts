import { describe, expect, it } from "vitest";
import {
	DIRECTORY_TARGET_EXTENSIONS,
	FILE_TARGET_EXTENSIONS,
} from "../features/target-intake/services/investigate-command";

const normalize = (value: string) => value.trim().toLowerCase();

describe("file-tree targets", () => {
	it("lists extensions the way the host matches them", () => {
		for (const extension of [...FILE_TARGET_EXTENSIONS, ...DIRECTORY_TARGET_EXTENSIONS]) {
			expect(extension).toBe(normalize(extension));
			expect(extension).not.toMatch(/^\./u);
			expect(extension).not.toMatch(/\s/u);
		}
	});

	it("has no duplicates within a list", () => {
		expect(new Set(FILE_TARGET_EXTENSIONS).size).toBe(FILE_TARGET_EXTENSIONS.length);
		expect(new Set(DIRECTORY_TARGET_EXTENSIONS).size).toBe(DIRECTORY_TARGET_EXTENSIONS.length);
	});

	it("covers the macOS bundle both as a directory and as a package file", () => {
		// A `.app` is a directory on macOS and a file on HarmonyOS; the host matches
		// one resourceType per contribution, so both lists must carry it.
		expect(DIRECTORY_TARGET_EXTENSIONS).toContain("app");
		expect(FILE_TARGET_EXTENSIONS).toContain("app");
	});

	it("keeps the formats REA has dedicated support for", () => {
		for (const extension of ["asar", "apk", "ipa", "gguf", "safetensors", "wasm", "pck", "har", "saz", "ips", "pyc"]) {
			expect(FILE_TARGET_EXTENSIONS).toContain(extension);
		}
	});

	it("refuses generic archives, extensionless binaries and over-broad suffixes", () => {
		// These would either show up on unrelated files or lead to an investigation
		// REA cannot start: a zip is not a target, and `.dat`/`.db` say nothing.
		for (const extension of ["zip", "tar", "gz", "7z", "dat", "db", "json", "txt", "md", "js", "ts"]) {
			expect(FILE_TARGET_EXTENSIONS).not.toContain(extension);
			expect(DIRECTORY_TARGET_EXTENSIONS).not.toContain(extension);
		}
	});
});
