import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifestPath = ".vetta/marketplace.json";
const options = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 };
const git = (...args) => execFileSync("git", args, options).trim();

function optionalRef(ref) {
  try { return git("rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`); }
  catch { return null; }
}

function requireRef(ref) {
  const commit = optionalRef(ref);
  if (!commit) throw new Error(`无法读取比较基线 ${ref}，请先 git fetch origin；检查不会跳过缺失的基线。`);
  return commit;
}

function readVersion(object) {
  let version;
  try { version = JSON.parse(git("show", `${object}:${manifestPath}`)).marketplaceVersion; }
  catch { throw new Error(`${object || "暂存区"} 的 ${manifestPath} 缺失、未暂存或不是有效 JSON。`); }
  const match = typeof version === "string" && /^(\d{4})\.(\d{2})\.(\d{2})-([1-9]\d*)$/u.exec(version);
  if (!match) throw new Error(`${object || "暂存区"} 的 marketplaceVersion 必须使用 YYYY.MM.DD-N（N 为正整数）。`);
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`marketplaceVersion 日期无效：${version}`);
  }
  return { value: version, date, sequence: BigInt(match[4]) };
}

function assertNewer(candidate, baseline, label) {
  if (candidate.date > baseline.date || (candidate.date === baseline.date && candidate.sequence > baseline.sequence)) return;
  throw new Error(
    `marketplaceVersion 未递增：待提交版本 ${candidate.value}，${label} 为 ${baseline.value}。\n` +
    `任何提交（含文档、构建产物、合并和空提交）都必须使用新版本。\n` +
    `请更新 ${manifestPath} 的 marketplaceVersion，并执行 git add ${manifestPath} 后重试。`
  );
}

function checkStaged() {
  if (git("ls-files", "--unmerged")) throw new Error("请先解决全部暂存区冲突。");
  const candidate = readVersion("");
  const baselines = new Set([optionalRef("HEAD"), optionalRef("refs/remotes/origin/main"), optionalRef("@{upstream}")].filter(Boolean));
  const mergeHead = git("rev-parse", "--git-path", "MERGE_HEAD");
  try {
    for (const ref of readFileSync(mergeHead, "utf8").trim().split(/\s+/u)) baselines.add(requireRef(ref));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const baseline of baselines) assertNewer(candidate, readVersion(baseline), baseline.slice(0, 12));
  console.log(`marketplaceVersion 检查通过：暂存区 ${candidate.value}`);
}

function checkRange(baseRef, headRef) {
  const base = requireRef(baseRef);
  const head = requireRef(headRef);
  if (base === head) return;
  if (git("rev-parse", "--is-shallow-repository") === "true") throw new Error("提交范围检查需要完整历史，请使用 fetch-depth: 0 或 git fetch --unshallow。");
  assertNewer(readVersion(head), readVersion(base), `基线 ${base.slice(0, 12)}`);
  const commits = git("rev-list", "--reverse", "--topo-order", head, `^${base}`).split("\n").filter(Boolean);
  for (const commit of commits) {
    const candidate = readVersion(commit);
    const parents = git("show", "-s", "--format=%P", commit).split(" ").filter(Boolean);
    for (const parent of parents) assertNewer(candidate, readVersion(parent), `${commit.slice(0, 12)} 的父提交 ${parent.slice(0, 12)}`);
  }
  console.log(`marketplaceVersion 检查通过：${commits.length} 个提交，目标 ${readVersion(head).value}`);
}

function checkPush() {
  for (const line of readFileSync(0, "utf8").trim().split("\n").filter(Boolean)) {
    const [, localSha, , remoteSha] = line.trim().split(/\s+/u);
    if (!localSha || !remoteSha) throw new Error("无效的 pre-push 输入。");
    if (/^0+$/u.test(localSha)) continue;
    const base = /^0+$/u.test(remoteSha) ? optionalRef("refs/remotes/origin/main") : requireRef(remoteSha);
    if (!base) throw new Error("新分支缺少 origin/main 比较基线，请先 git fetch origin。");
    checkRange(base, localSha);
  }
}

try {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === "--staged")) checkStaged();
  else if (args.length === 3 && args[0] === "--range") checkRange(args[1], args[2]);
  else if (args.length === 1 && args[0] === "--pre-push") checkPush();
  else throw new Error("用法：node scripts/check-marketplace-version.mjs [--staged | --range <base> <head> | --pre-push]");
} catch (error) {
  console.error(`[marketplace-version] ${error.message}`);
  process.exitCode = 1;
}
