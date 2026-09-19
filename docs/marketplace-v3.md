# 静态能力市场发布

采用 Helm chart-releaser 模式：普通源码 PR → 人工审核合并 → CI 构建新版本 → GitHub Releases → gh-pages 静态索引。

## 三个位置

- main：能力源码与 `.vetta/marketplace.source.json`，不存构建包或发布索引。
- Releases：不可变 `.vettapkg`；历史 `.zip` 可以继续被目录引用。
- gh-pages：CI 生成 `.vetta/marketplace.json`、展示资源和非插件安装文件。

Desktop 添加仓库时使用分支 gh-pages。无需开启 GitHub Pages；包括私有仓库在内，都可以沿用 GitHub 分支读取和鉴权。
客户端下载的精简快照只包含分发内容，不包含源码仓库；插件安装时单独下载 Release 包。

## 发布一个版本

1. 修改源码；准备发布时提高能力版本，保持源码条目、ability.json 和类型身份文件版本一致。
2. Plugin 在源码条目上声明 minAppVersion，包括仅 Bundle 引用的成员。
3. 普通 PR 检查源码、构建候选内容并核实宿主兼容性。保护 main，要求人工审核和 marketplace-source 检查。
4. 合并后 Publish ability marketplace 自动发布。版本没变的插件不重建、不覆盖；非插件运行文件也保留至版本提高。
5. CI 上传并核对包之后才更新 gh-pages。文档开发提交不增加市场版本；分发内容变化时 CI 自动分配版本。

插件 API、权限、命令和 SHA-256 从包派生，不手工维护 releases。展示资源变化可以单独更新目录。
无需发布计划文件、机器人目录 PR 或每个源码提交的市场版本递增。

## 检查与恢复

```bash
node scripts/marketplace.mjs check
node --test tests/*.test.mjs
node scripts/marketplace.mjs build
```

Node.js 22.21.1+、Python 3、Git 为前置依赖。Windows Python shim 环境设置 VETTA_PYTHON 为实际解释器路径。
每次构建使用空输出目录（--output DIR），增量构建传入 --previous 指向 gh-pages 的检出目录。
本地构建不上传，不访问用户 Desktop 数据。

构建任务无写凭证，发布任务具有 contents: write，不执行插件构建脚本。
.vetta/publish.json 固定 Desktop 校验工具提交；调整它也需源码 PR 审核。
稳定发布仍要求最低 Desktop 已正式发布且提供所需 API。不能以本地开发版通过为由跳过该门禁。

同一版本存在时核对字节，禁止覆盖。上传部分失败时重新运行最新源码的工作流；源码或 gh-pages 已前进时，旧运行拒绝写入。
GitHub Release 和索引不是跨服务事务：索引失败时包可能已经公开，但市场仍保持上一份有效目录。

## 迁移

旧客户端正在使用的历史 ref 保持原样。验证首次 gh-pages 发布成功后，再显式切换新版 Desktop 来源。
如果线上旧客户端仍固定读取 main，不能直接把源码分离变更合入该 main；应先发布客户端来源迁移，或把新源码与流水线放在独立仓库完成过渡。
有有效历史 v3 分发时，将经过验证的目录和资源导入 gh-pages 再接入发布工具；不可导入 404 或摘要不符的制品记录。
本次官方旧 v3 测试目录存在不可下载的 Release 地址，因此新分发首次运行从源码生成真实制品。
新建市场不需要任何历史引导配置。
