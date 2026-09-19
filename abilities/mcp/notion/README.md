# Notion

This package connects Vetta to Notion's official hosted MCP endpoint at
`https://mcp.notion.com/mcp`.

Installation does not require a Notion developer application, an Internal Integration Secret or a
local runtime. Vetta starts the standard browser OAuth flow after installation; the user signs in,
selects a workspace and approves the permissions shown by Notion.

The package deliberately declares no credential parameters. OAuth state is stored by the Vetta
desktop client on the user's device and can be cleared by disconnecting the connector.

Official setup documentation: <https://developers.notion.com/guides/mcp/get-started-with-mcp>
