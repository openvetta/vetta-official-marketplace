# Xiaohongshu Accounts plugin

This plugin owns Xiaohongshu login, account sessions and the MCP connection. It runs the pinned
`xpzouying/xiaohongshu-mcp` binary as a plugin-managed loopback service and keeps the complete upstream
session document per account. MCP tools accept an optional `account_id`; when it is omitted, the active
account remains the backwards-compatible default. Requests for different accounts use isolated browser
contexts and can run concurrently without stopping or switching the service.

QR rendering is implemented inside the plugin with the `qrcode` package; the host does not need a Xiaohongshu-
specific QR API. The ability detail slot reports preparation, QR retrieval, scan waiting, verification and
failure states. The workspace view lists saved accounts and exposes switching/removal actions.

The host-side `type: "service"` MCP binding and service data-file API are generic Plugin SDK capabilities. They
do not contain Xiaohongshu routes, cookie parsing or account policy.

Startup probes the upstream `/health` endpoint. Login status is checked separately by the plugin:
it can launch a browser and contact Xiaohongshu, so it must not be used as the host's startup health probe.
