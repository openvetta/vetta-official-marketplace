# Cloudflare Documentation in Vetta

This package connects Vetta directly to Cloudflare's official hosted documentation endpoint:

```text
https://docs.mcp.cloudflare.com/mcp
```

It uses Streamable HTTP and needs no local MCP runtime or package installation. The package does not
collect an API token and does not enable browser authorization. It is intended for public Cloudflare
documentation and reference lookup, not account-resource access.

Cloudflare documents the endpoint in its
[official MCP server catalog](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/).
The upstream implementation is published in
[`cloudflare/mcp-server-cloudflare`](https://github.com/cloudflare/mcp-server-cloudflare) under
Apache-2.0.

If the hosted service changes its transport or authorization contract, update `mcp.json`, the
ability version when its installation contract changes, and the marketplace version together.
