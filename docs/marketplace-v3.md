# Schema v3 市场发布流程

`main` 继续提供 schema v2 目录包，供旧 Desktop 使用。`marketplace-v3` 是独立来源：
只跟踪插件源码、`plugin.json`、展示资源和目录索引，安装 ZIP 放在 GitHub Release asset。
Desktop 0.5.59 及以后才能读取这个来源。已发布的 0.5.58 只支持 schema v1/v2。
两个来源不能共用同一个 ref。

## 准备一个插件版本

1. 在插件目录安装依赖、运行测试并构建。确认 `plugin.json` 的 `id`、`version`、
   `pluginApiVersion`、权限和命令与实际使用的能力一致。构建输出留在本地 `dist/`。
2. 在市场根目录生成固定 ZIP 和相应的目录记录：

   ```bash
   python3 scripts/stage-plugin-release.py feishu --min-app-version 0.5.59
   ```

   ZIP 与 JSON 写入被 Git 忽略的 `.release-artifacts/`。脚本只收集运行所需的
   `plugin.json`、`dist/`、资源、语言包和 Agent 文件，拒绝缺少入口、样式或包含符号
   链接的包。相同输入生成相同 ZIP。不能用新字节覆盖已发布版本；要修改就提升插件版本。
3. 所有待发布插件准备好后，登记版本记录并递增市场快照号：

   ```bash
   node scripts/stage-v3-catalog.mjs --marketplace-version 2026.09.18-3 --min-app-version 0.5.59 --all
   ```

   后续只更新一个插件时使用 `--slug <id>` 代替 `--all`。脚本检查本地 ZIP 摘要、
   `plugin.json` 合同和旧版本记录；拒绝改写已有版本。组合包专属插件的记录写在成员上。

## 上传、验证与晋级

上传 `.release-artifacts/<slug>-<version>.zip` 的**原始字节**到目录记录中的固定
GitHub Release tag 和文件名，不在上传时重新打包。建议为仓库启用 Immutable releases。
市场 PR 的 `marketplace-check` 会重新构建插件、核对 ZIP 摘要，并调用 Desktop 仓库的
`check-plugin-marketplace-publication.mjs`：所声明的最低 App 版本必须已有正式稳定
GitHub Release、该版本的 Plugin API 必须满足要求、远端 ZIP 必须可下载且摘要一致。
门禁不通过时不得将目录发布到 `marketplace-v3`。

首次迁移时，先从 `main` 创建 `marketplace-v3` ref，让它暂时提供原有 schema v2
目录；将 Desktop 0.5.59 的发行配置 `VETTA_OPEN_MARKETPLACE_REF` 设为
`marketplace-v3`，再发布包含 v3 解析能力的 Desktop 0.5.59。这样新客户端在目录晋级前
仍可使用旧目录。接着上传固定 ZIP，通过发布门禁后把候选 v3 目录晋级到该 ref。
已发布的 0.5.58 继续指向 `main`。切换前要用正式发行构建分别验证旧来源和 v3
来源的列出、下载、安装与更新。

每次市场归档内容变化都要使用严格递增的 `marketplaceVersion`，并新增同版本发布说明。
回滚时恢复先前已验证的制品引用，再创建一个更高的市场版本；不要替换旧 ZIP 或复用
旧市场版本。

当前候选目录中的 ZIP 仅在本地 `.release-artifacts/`，且 Desktop 0.5.59 尚未发布。
候选清单用于审查和本地合同测试，不能直接晋级到公开来源。
