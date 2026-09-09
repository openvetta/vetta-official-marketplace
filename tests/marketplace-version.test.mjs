import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checker = join(source, "scripts/check-marketplace-version.mjs");

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "vetta-version-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (command, args, input) => spawnSync(command, args, { cwd: root, encoding: "utf8", input });
  const git = (...args) => {
    const result = run("git", args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const version = (value) => write(".vetta/marketplace.json", JSON.stringify({ marketplaceVersion: value }));
  const check = (...args) => run(process.execPath, [checker, ...args]);
  git("init", "-b", "main");
  git("config", "user.name", "Version test");
  git("config", "user.email", "version-test@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", ".githooks");
  version("2026.09.09-8");
  write("README.md", "initial\n");
  git("add", ".vetta/marketplace.json", "README.md");
  git("commit", "-m", "initial");
  const initial = git("rev-parse", "HEAD");
  const install = () => {
    for (const path of ["scripts/check-marketplace-version.mjs", "scripts/install-git-hooks.mjs", ".githooks/pre-commit", ".githooks/pre-merge-commit", ".githooks/pre-push"]) {
      write(path, readFileSync(join(source, path)));
    }
    const result = run(process.execPath, ["scripts/install-git-hooks.mjs"]);
    assert.equal(result.status, 0, result.stderr);
  };
  return { root, run, git, write, version, check, initial, install };
}

test("real commit blocks a missing or unstaged bump, then succeeds once the new version is staged", (t) => {
  const f = fixture(t);
  f.install();
  f.write("README.md", "changed\n");
  f.git("add", "README.md");
  let result = f.run("git", ["commit", "-m", "should fail"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /marketplaceVersion 未递增/u);
  assert.equal(f.git("rev-parse", "HEAD"), f.initial);
  f.version("2026.09.09-9");
  result = f.run("git", ["commit", "-m", "unstaged bump"]);
  assert.notEqual(result.status, 0);
  f.git("add", ".vetta/marketplace.json");
  f.git("commit", "-m", "valid bump");
  assert.equal(JSON.parse(f.git("show", "HEAD:.vetta/marketplace.json")).marketplaceVersion, "2026.09.09-9");
  assert.notEqual(f.run("git", ["commit", "--allow-empty", "-m", "empty reuse"]).status, 0);
});

test("the staged version is authoritative even if the working file has another value", (t) => {
  const f = fixture(t);
  f.version("2026.09.09-9");
  f.git("add", ".vetta/marketplace.json");
  f.version("2026.09.09-8");
  assert.equal(f.check().status, 0);
});

test("numeric increments and a later date pass; reused, regressed and malformed versions fail", (t) => {
  const f = fixture(t);
  for (const value of ["2026.09.09-9", "2026.09.09-10", "2026.09.10-1"]) {
    f.version(value);
    f.git("add", ".vetta/marketplace.json");
    assert.equal(f.check().status, 0, value);
  }
  for (const value of ["2026.09.09-8", "2026.09.09-7", "2026.09.08-99", "1.0.9", "2026.02.30-1", "2026.09.09-0", "2026.09.09-09"]) {
    f.version(value);
    f.git("add", ".vetta/marketplace.json");
    assert.notEqual(f.check().status, 0, value);
  }
  f.write(".vetta/marketplace.json", "{broken");
  f.git("add", ".vetta/marketplace.json");
  assert.notEqual(f.check().status, 0);
  f.git("rm", "-f", ".vetta/marketplace.json");
  assert.notEqual(f.check().status, 0);
});

test("stale branches cannot reuse the version already present on origin/main", (t) => {
  const f = fixture(t);
  f.version("2026.09.09-10");
  f.git("add", ".vetta/marketplace.json");
  f.git("commit", "-m", "remote update");
  f.git("update-ref", "refs/remotes/origin/main", "HEAD");
  f.git("switch", "-c", "stale", f.initial);
  f.version("2026.09.09-10");
  f.git("add", ".vetta/marketplace.json");
  assert.notEqual(f.check().status, 0);
  f.version("2026.09.09-11");
  f.git("add", ".vetta/marketplace.json");
  assert.equal(f.check().status, 0);
});

test("CI rejects an intermediate reused version even if the final commit bumps it", (t) => {
  const f = fixture(t);
  f.write("README.md", "missed bump\n");
  f.git("add", "README.md");
  f.git("commit", "-m", "missed bump");
  f.version("2026.09.09-9");
  f.git("add", ".vetta/marketplace.json");
  f.git("commit", "-m", "late bump");
  const result = f.check("--range", f.initial, "HEAD");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /父提交/u);
  assert.notEqual(f.check("--range", "missing-baseline", "HEAD").status, 0);
});

test("CI and push accept successive new versions and inspect the committed tree rather than an unstaged bump", (t) => {
  const f = fixture(t);
  for (const value of ["2026.09.09-9", "2026.09.09-10"]) {
    f.version(value);
    f.git("add", ".vetta/marketplace.json");
    f.git("commit", "-m", value);
  }
  assert.equal(f.check("--range", f.initial, "HEAD").status, 0);
  const head = f.git("rev-parse", "HEAD");
  const push = (sha) => f.run(process.execPath, [checker, "--pre-push"], `refs/heads/main ${sha} refs/heads/main ${f.initial}\n`);
  assert.equal(push(head).status, 0);
  f.git("commit", "--allow-empty", "-m", "reused version");
  f.version("2026.09.09-11");
  assert.notEqual(push(f.git("rev-parse", "HEAD")).status, 0);
  assert.equal(push("0".repeat(40)).status, 0);
});

test("merge checks compare against both parents, including the pending MERGE_HEAD", (t) => {
  const f = fixture(t);
  f.git("switch", "-c", "topic");
  f.version("2026.09.09-10");
  f.git("add", ".vetta/marketplace.json");
  f.git("commit", "-m", "topic update");
  const topic = f.git("rev-parse", "HEAD");
  f.git("switch", "main");
  f.write("README.md", "main update\n");
  f.version("2026.09.09-9");
  f.git("add", "README.md", ".vetta/marketplace.json");
  f.git("commit", "-m", "main update");
  f.run("git", ["merge", "--no-commit", "topic"]);
  assert.notEqual(f.check().status, 0);
  f.version("2026.09.09-10");
  f.git("add", ".vetta/marketplace.json");
  assert.notEqual(f.check().status, 0);
  f.version("2026.09.09-11");
  f.git("add", ".vetta/marketplace.json");
  assert.equal(f.check().status, 0);
  f.git("commit", "-m", "merge with new snapshot");
  assert.equal(f.check("--range", topic, "HEAD").status, 0);
});

test("a local push hook rejects a skipped-commit-hook update before the remote changes", (t) => {
  const f = fixture(t);
  const remote = join(f.root, "remote.git");
  f.git("init", "--bare", remote);
  f.git("remote", "add", "origin", remote);
  f.git("push", "-u", "origin", "main");
  f.install();
  f.write("README.md", "invalid push\n");
  f.git("add", "README.md");
  // Create an intentionally invalid fixture without changing the installed hook configuration.
  const tree = f.git("write-tree");
  const badCommit = f.git("commit-tree", tree, "-p", f.initial, "-m", "invalid fixture");
  f.git("update-ref", "refs/heads/main", badCommit);
  const result = f.run("git", ["push", "origin", "main"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /marketplaceVersion 未递增/u);
  assert.equal(f.git("--git-dir", remote, "rev-parse", "refs/heads/main"), f.initial);
});

test("hook installation is repeatable and refuses to replace another hooks directory", (t) => {
  const f = fixture(t);
  f.install();
  f.install();
  f.git("config", "core.hooksPath", "custom-hooks");
  const result = f.run(process.execPath, ["scripts/install-git-hooks.mjs"]);
  assert.notEqual(result.status, 0);
  assert.equal(f.git("config", "--get", "core.hooksPath"), "custom-hooks");
});

test("installing hooks preserves existing default hooks instead of disabling them", (t) => {
  const f = fixture(t);
  f.install();
  f.git("config", "--unset", "core.hooksPath");
  f.write(".git/hooks/commit-msg", "#!/bin/sh\nexit 0\n");
  const result = f.run(process.execPath, ["scripts/install-git-hooks.mjs"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /commit-msg/u);
  assert.equal(readFileSync(join(f.root, ".git/hooks/commit-msg"), "utf8"), "#!/bin/sh\nexit 0\n");
});

test("automated commits validate the index after staging, including the skip-ci service update", () => {
  for (const name of ["xiaohongshu-service.yml", "update-cli-proxy-api.yml"]) {
    const workflow = readFileSync(join(source, ".github/workflows", name), "utf8");
    const lines = workflow.split(/\r?\n/u).map((line) => line.trim());
    const commits = lines.flatMap((line, index) => line.startsWith("git commit ") ? [index] : []);
    assert.ok(commits.length > 0, name);
    for (const index of commits) {
      assert.equal(lines[index - 1], "node scripts/check-marketplace-version.mjs --staged", name);
      assert.match(lines[index - 2], /^git add /u, name);
    }
  }
});
