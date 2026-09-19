import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = process.platform === "win32" ? "python" : "python3";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("staging a plugin creates a repeatable archive and release record without tracking build files", () => {
  const temporary = mkdtempSync(join(tmpdir(), "vetta-plugin-release-"));
  try {
    const run = () => JSON.parse(execFileSync(python, [
      "scripts/stage-plugin-release.py", "feishu", "--min-app-version", "0.5.59",
      "--output-dir", temporary,
    ], { cwd: root, encoding: "utf8", shell: process.platform === "win32" }));
    const first = run();
    const archive = readFileSync(join(temporary, "feishu-1.0.4.vettapkg"));
    assert.equal(first.artifact.sha256, sha256(archive));
    assert.deepEqual(run(), first);
    assert.deepEqual(readFileSync(join(temporary, "feishu-1.0.4.vettapkg")), archive);
    assert.match(first.artifact.url, /\/feishu-1\.0\.4\.vettapkg$/u);
    const listing = execFileSync(python, ["-m", "zipfile", "-l", join(temporary, "feishu-1.0.4.vettapkg")], {
      encoding: "utf8", shell: process.platform === "win32",
    });
    assert.match(listing, /plugin\.json/u);
    assert.match(listing, /dist\/remoteEntry\.js/u);
    assert.doesNotMatch(listing, /src\/|node_modules\//u);
  } finally {
    if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep)) {
      throw new Error("Unsafe temporary release path");
    }
    rmSync(temporary, { recursive: true, force: true });
  }
});
