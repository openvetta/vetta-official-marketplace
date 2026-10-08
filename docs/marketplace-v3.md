# 静态能力市场发布

采用 Helm chart-releaser 模式：普通源码 PR → 人工审核合并 → CI 构建新版本 → GitHub Releases → gh-pages 静态索引。

## 三个位置

- main：能力源码与 `.vetta/marketplace.source.json`，不存构建包或发布索引。
- Releases：每个插件使用一个 `plugin-<slug>` Release，里面按版本追加不可变 `.vettapkg`；历史 `.zip` 可以继续被目录引用。
- gh-pages：CI 生成 `.vetta/marketplace.json`、展示资源和非插件安装文件。

Desktop 添加仓库时使用分支 gh-pages。无需开启 GitHub Pages；包括私有仓库在内，都可以沿用 GitHub 分支读取和鉴权。
客户端下载的精简快照只包含分发内容，不包含源码仓库；插件安装时单独下载 Release 包。

## 发布一个版本

1. 同一批未发布的分发内容变更只提升一次能力版本：源码版本仍等于已发布版本时提升一次，已有待发布版本则沿用。后续修改、测试和本地安装不再递增；发布前核对源码条目、ability.json 和类型身份文件一致，不额外加号。
2. Plugin 在源码条目上声明 minAppVersion，包括仅 Bundle 引用的成员。
3. 普通 PR 以 main 为基准分支，检查源码、构建候选内容并核实宿主兼容性。保护 main，要求人工审核和 marketplace 检查。
4. 合并后 Publish ability marketplace 自动发布。版本没变的插件不重建、不覆盖；新版本以 `<slug>-<version>.vettapkg` 追加到该插件固定的 `plugin-<slug>` Release。非插件运行文件也保留至版本提高。
5. CI 上传并核对包之后才更新 gh-pages。已存在的同名资产只能校验、不能删除或替换。文档开发提交不增加市场版本；分发内容变化时 CI 自动分配版本。

插件 API、权限、命令和 SHA-256 从包派生，不手工维护 releases。展示资源变化可以单独更新目录。
无需发布计划文件、机器人目录 PR 或每个源码提交的市场版本递增。

## 检查与恢复

```bash
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build
node --test tests/*.test.mjs
```

Node.js 22.21.1+、Python 3、Git 为前置依赖。Windows Python shim 环境设置 VETTA_PYTHON 为实际解释器路径。
每次构建使用空输出目录（--output DIR），增量构建传入 --previous 指向 gh-pages 的检出目录。内容测试会检查生成后的插件资源，因此在候选构建完成后运行。
本地构建不上传，不访问用户 Desktop 数据。

构建任务无写凭证，发布任务具有 contents: write，不执行插件构建脚本。
.vetta/publish.json 固定 Desktop 校验工具提交；调整它也需源码 PR 审核。
通常要求最低 Desktop 已正式发布且提供所需 API。首次联调尚未正式发布的 Desktop 版本时，
`candidateAppCommits` 可以把精确版本钉到 OpenVetta 的 40 位不可变 commit；门禁会从该提交
核对 Desktop 版本、Plugin API 和 schema v3。候选只在稳定 Release 返回 404 时生效，正式
Release 一旦存在便优先检查 Release，不能用候选配置绕过不完整发布或本地未提交代码。

同一版本存在时核对字节，禁止覆盖。每个插件的 Release 是追加式容器，不把 Release tag 当作单个版本标识；具体版本、兼容性和摘要以 gh-pages 索引为准。上传部分失败时重新运行最新源码的工作流；源码或 gh-pages 已前进时，旧运行拒绝写入。
GitHub Release 和索引不是跨服务事务：索引失败时包可能已经公开，但市场仍保持上一份有效目录。

## 迁移

受支持的 Desktop 读取 `gh-pages`。`main` 是源码分支，生成的 `.vetta/marketplace.json` 只存在于 `gh-pages`。
有有效历史 v3 分发时，将经过验证的目录和资源导入 gh-pages 再接入发布工具；不可导入 404 或摘要不符的制品记录。
本次官方旧 v3 测试目录存在不可下载的 Release 地址，因此当前 gh-pages 由源码生成真实制品。
新建市场不需要任何历史引导配置。源码分支使用 `main`，分发分支使用 `gh-pages`。
