# Cloudflare API in Vetta

This package connects Vetta directly to Cloudflare's official hosted Code Mode endpoint:

```text
https://mcp.cloudflare.com/mcp
```

It uses Streamable HTTP and Cloudflare's OAuth flow. Vetta opens the browser for authorization and
stores the resulting MCP OAuth state locally; no developer application, API token or local MCP
runtime is required by this package. Users choose the permissions granted during Cloudflare
authorization.

The default Code Mode endpoint exposes a compact documentation/search/execution surface rather
than registering thousands of API endpoints as individual tools. Cloudflare runs generated API
orchestration code in an isolated Worker and restricts outbound access. See the
[official server documentation](https://github.com/cloudflare/mcp) for the current security model
and supported API coverage.

Do not add `autoApprove` to this package. Depending on the granted scopes, the connection can read,
create, update or delete real account resources, and some Cloudflare products can incur charges.
Use a test account or least-privilege authorization for initial verification.

Cloudflare also supports manually supplied API tokens for automation. This Vetta package
intentionally offers only the recommended browser OAuth path so the installation flow does not mix
two credential models.
