# Schema v3 市场发布流程

`main` 继续提供 schema v2 目录包，供旧 Desktop 使用。当前测试来源使用
`refa/marketplace-v3`：
只跟踪插件源码、`plugin.json`、展示资源和目录索引，安装 `.vettapkg` 放在 GitHub Release asset。
Desktop 0.5.59 及以后才能读取这个来源。已发布的 0.5.58 只支持 schema v1/v2。
两个来源不能共用同一个 ref。

## 准备一个插件版本

1. 在插件目录安装依赖、运行测试并构建。确认 `plugin.json` 的 `id`、`version`、
   `pluginApiVersion`、权限和命令与实际使用的能力一致。构建输出留在本地 `dist/`。
2. 日常开发时可以在市场根目录生成固定 `.vettapkg` 和相应的目录记录，用于提交前验证：

   ```bash
   python3 scripts/stage-plugin-release.py feishu --min-app-version 0.5.59
   ```

   `.vettapkg` 与 JSON 写入被 Git 忽略的 `.release-artifacts/`。包本身使用 ZIP 容器；
   脚本只收集运行所需的
   `plugin.json`、`dist/`、资源、语言包和 Agent 文件，拒绝缺少入口、样式或包含符号
   链接的包。相同输入生成相同 `.vettapkg`。不能用新字节覆盖已发布版本；要修改就提升插件版本。
3. 本地验证需要登记版本记录时，递增市场快照号：

   ```bash
   node scripts/stage-v3-catalog.mjs --marketplace-version 2026.09.18-3 --min-app-version 0.5.59 --all
   ```

   后续只更新一个插件时使用 `--slug <id>` 代替 `--all`。脚本检查本地包摘要、
   `plugin.json` 合同和旧版本记录；拒绝改写已有版本。组合包专属插件的记录写在成员上。

## 上传、验证与晋级

正式发布不使用开发者本机生成的包。先把插件源码和版本变更提交到目标市场分支；也可以
使用包含目标分支最新提交的仓库内分支。然后从 GitHub Actions 手动运行
**Publish plugin release candidate**，填写插件 slug、源码分支、目标市场分支和可选的最低
Desktop 版本。工作流会在 CI 中安装依赖、
运行插件检查和测试、构建 `.vettapkg`，并把原始字节上传到固定 GitHub Release。

工作流随后基于所选源码提交创建 `automation/plugin-<slug>-<version>` 分支，把 Release URL、
SHA-256 和合同字段登记到目录，并创建一个 Draft PR。它不会直接写入或自动合并目标市场
分支；维护者必须审查 PR、等待市场与 Desktop 发布门禁通过，再手动标记 ready 和合并。
建议为目标市场分支启用必需审查、必需状态检查和 Immutable releases。
仓库的 Actions 设置必须允许工作流读写 Contents、创建 Pull Request 和调度检查；权限仍由
工作流中的最小 `permissions` 声明约束。

本地生成的包只用于预检，不能替代 CI 发布，也不能在上传时重新打包或改名。
市场 PR 的 `marketplace-check` 会重新构建插件、核对包摘要，并调用 Desktop 仓库的
`check-plugin-marketplace-publication.mjs`：所声明的最低 App 版本必须已有正式稳定
GitHub Release、该版本的 Plugin API 必须满足要求、远端包必须可下载且摘要一致。
门禁不通过时不得将目录发布到 `refa/marketplace-v3`。

首次迁移时，先从 `main` 创建独立的 schema v3 ref，让它暂时提供原有 schema v2
目录；将 Desktop 0.5.59 的发行配置 `VETTA_OPEN_MARKETPLACE_REF` 设为
该 ref，再发布包含 v3 解析能力的 Desktop 0.5.59。这样新客户端在目录晋级前
仍可使用旧目录。接着上传固定 `.vettapkg`，通过发布门禁后把候选 v3 目录晋级到该 ref。
已发布的 0.5.58 继续指向 `main`。切换前要用正式发行构建分别验证旧来源和 v3
来源的列出、下载、安装与更新。

每次市场归档内容变化都要使用严格递增的 `marketplaceVersion`，并新增同版本发布说明。
回滚时恢复先前已验证的制品引用，再创建一个更高的市场版本；不要替换旧包或复用
旧市场版本。

当前候选目录中的包仅在本地 `.release-artifacts/`，且 Desktop 0.5.59 尚未发布。
候选清单用于审查和本地合同测试，不能直接晋级到公开来源。
