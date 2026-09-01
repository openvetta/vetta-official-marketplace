# 在 Vetta 中使用 Cloudflare 文档

这个包让 Vetta 直接连接 Cloudflare 官方托管的文档端点：

```text
https://docs.mcp.cloudflare.com/mcp
```

连接使用 Streamable HTTP，不需要本地 MCP 运行时或额外安装软件。包不会收集 API Token，
也不会开启浏览器授权；它用于查询公开的 Cloudflare 文档和参考资料，不访问账号资源。

Cloudflare 在[官方 MCP 服务目录](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/)
中记录了该端点。上游实现位于
[`cloudflare/mcp-server-cloudflare`](https://github.com/cloudflare/mcp-server-cloudflare)，
采用 Apache-2.0 许可证。

如果托管服务未来改变传输或授权合同，应同时更新 `mcp.json`、必要时更新能力版本，并提升市场版本。
