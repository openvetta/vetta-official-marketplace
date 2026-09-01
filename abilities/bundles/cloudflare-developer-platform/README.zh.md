# Cloudflare 开发平台：接入与安全说明

本文说明组合成员、首次设置和安全边界。Vetta 详情页使用独立的[用户介绍](detail.zh.json)，
另有[英文版本](detail.json)。

本组合包汇集三个 Cloudflare 官方 Skill 和两个 Cloudflare 托管 MCP 服务。「发现」中只展示
组合入口；每个成员仍有稳定身份，可以在 Vetta 中独立选择、安装、卸载和启停。

## 选择安装成员

- **Cloudflare 平台**：以检索为先，覆盖 Workers、Pages、存储、AI、网络、安全和基础设施即代码。
- **Wrangler**：为官方的项目本地 CLI 提供最新命令与配置指南。
- **Workers 最佳实践**：审查 Workers 代码与配置中的生产风险。
- **Cloudflare 文档**：通过 Cloudflare 托管 MCP 搜索公开文档；无需登录、凭据或本地运行时。
- **Cloudflare API**：通过 Cloudflare 托管的 Code Mode MCP 操作账号资源；需要浏览器授权。

只做开发和公开资料查询时，可选择前四项而不授权账号。只有当 Vetta 需要查看或修改无法从项目
现有 Wrangler 会话获取的资源时，再添加 Cloudflare API。

## 运行时与授权

两个 MCP 成员通过 Streamable HTTP 连接 `https://docs.mcp.cloudflare.com/mcp` 和
`https://mcp.cloudflare.com/mcp`，不会安装本地可执行文件，也不会要求在 Vetta 中填写 API Token。
Cloudflare 文档是公开服务；Cloudflare API 会启动 Cloudflare 浏览器 OAuth 流程，请只选择完成任务
所需的最小账号、资源和操作范围。

本组合包不会全局安装 Wrangler。Skill 会遵循仓库使用的包管理器，并使用项目本地的 Wrangler
依赖。尚未包含 Wrangler 的项目，执行命令前可能需要 Node.js、网络访问和一次明确的依赖安装。

## 安全边界

Skill 提供操作指南，不会自动执行部署，也不会绕过 Vetta 原有的命令和工具确认。Wrangler 与
Cloudflare API 都可能修改真实 DNS、部署、存储、安全配置和其他账号资源，部分操作还会产生费用。
建议先使用测试资源、最小权限和只读查询，并在写入、部署或删除前核对准确目标。

Cloudflare Code Mode 服务提供精简的 API 搜索与执行入口。生成的编排代码在隔离的 Cloudflare
Worker 中运行，并受服务端出站访问控制；它不是由本市场包安装到本机的代码。

## 来源与许可

三个 Skill 固定取自 [`cloudflare/skills`](https://github.com/cloudflare/skills) 的提交
`f96bff754e428838818017f75817f0f9428acd48`。各包保留上游源码与 Apache-2.0 许可证；Vetta 仅添加
包元数据、双语产品详情、上游版本和 Cloudflare 官方标志。托管服务仍受 Cloudflare 条款以及授权时
实际授予的权限约束。
