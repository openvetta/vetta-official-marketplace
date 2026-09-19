# 在 Vetta 中使用 Cloudflare API

这个包让 Vetta 直接连接 Cloudflare 官方托管的 Code Mode 端点：

```text
https://mcp.cloudflare.com/mcp
```

连接使用 Streamable HTTP 和 Cloudflare OAuth。Vetta 会打开浏览器完成授权，并把 MCP OAuth
状态保存在本机；这个包不要求开发者应用、API Token 或本地 MCP 运行时。用户在 Cloudflare
授权页面选择授予的权限。

默认 Code Mode 端点提供精简的文档、搜索和执行接口，不会把数千个 API Endpoint 全部注册成
独立工具。Cloudflare 会在隔离的 Worker 中运行生成的 API 编排代码，并限制其出站访问。
当前安全模型与 API 覆盖范围以[官方服务文档](https://github.com/cloudflare/mcp)为准。

不要为这个包增加 `autoApprove`。根据授予的权限，连接可以读取、新建、更新或删除真实账号资源，
部分 Cloudflare 产品也可能产生费用。首次验证应使用测试账号或最小权限授权。

Cloudflare 也允许自动化场景手工提供 API Token。这个 Vetta 包刻意只提供官方推荐的浏览器 OAuth，
避免在一个安装流程中混用两套凭据模型。
