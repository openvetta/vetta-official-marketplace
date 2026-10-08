import assert from "node:assert/strict";
import test from "node:test";
import { assertRuntimeUpgrade, assertUnchangedRuntimeAssets } from "../scripts/cli-proxy-api-release-policy.mjs";

test("runtime updates accept patches and minors but require explicit review for either component's major", () => {
  assert.doesNotThrow(() => assertRuntimeUpgrade("CPA", "8.0.17", "8.0.18"));
  assert.doesNotThrow(() => assertRuntimeUpgrade("CPA", "8.0.17", "8.1.0"));
  assert.throws(() => assertRuntimeUpgrade("CPA", "7.2.147", "8.0.17"), /major upgrade requires compatibility review/u);
  assert.throws(() => assertRuntimeUpgrade("Gemini", "1.0.5", "2.0.0"), /major upgrade requires compatibility review/u);
  assert.doesNotThrow(() => assertRuntimeUpgrade("CPA", "7.2.147", "8.0.17", { allowMajor: true }));
});

test("a reviewed major upgrade never authorizes a downgrade or a prerelease", () => {
  for (const version of ["7.3.20", "8.0.16", "8.0.18-rc1", "latest"]) {
    assert.throws(() => assertRuntimeUpgrade("CPA", "8.0.17", version, { allowMajor: true }));
  }
});

test("upgrading core cannot replace an unchanged Gemini asset", () => {
  const core = { url: "https://example.com/core-8.0.17.tar.gz", destination: "core", sha256: "a", archive: "tar.gz" };
  const gemini = { url: "https://example.com/gemini-1.0.5.zip", destination: "plugins", sha256: "b", archive: "zip" };
  const before = { "darwin-arm64": [core, gemini] };
  const upgraded = { ...core, url: "https://example.com/core-8.0.18.tar.gz", sha256: "c" };
  assert.doesNotThrow(() => assertUnchangedRuntimeAssets(before, { "darwin-arm64": [upgraded, gemini] }));
  assert.throws(() => assertUnchangedRuntimeAssets(before, { "darwin-arm64": [upgraded, { ...gemini, sha256: "changed" }] }), /asset changed/u);
});
