import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
try {
  const root = git("rev-parse", "--show-toplevel");
  process.chdir(root);
  let current;
  try { current = git("config", "--get", "core.hooksPath"); }
  catch (error) { if (error.status !== 1) throw error; }
  if (current && resolve(current) !== resolve(".githooks")) throw new Error(`已配置其他 Git hooks：${current}。请合并现有 hooks 后安装，避免覆盖。`);
  const hooks = ["pre-commit", "pre-merge-commit", "pre-push"];
  if (!current) {
    const directory = git("rev-parse", "--git-path", "hooks");
    const existing = existsSync(directory) ? readdirSync(directory).filter((name) => !name.endsWith(".sample")) : [];
    if (existing.length) throw new Error(`已有 Git hooks：${existing.join(", ")}，请先合并；安装不会覆盖现有 hooks。`);
  }
  for (const hook of hooks) chmodSync(`.githooks/${hook}`, 0o755);
  git("config", "--local", "core.hooksPath", ".githooks");
  console.log("已为当前仓库启用 marketplaceVersion 提交、合并及推送检查。");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
