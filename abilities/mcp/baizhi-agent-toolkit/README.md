# Baizhi Agent Toolkit

This optional Ability connects Vetta to Baizhi Cloud's hosted Agent Toolkit MCP server at <https://agent-toolkit.app.baizhi.cloud/mcp>. It uses Streamable HTTP and a key you create in the [Baizhi Cloud console](https://agent-toolkit.app.baizhi.cloud/). Enter only the key in Vetta's install form; `mcp.json` supplies `Authorization: Bearer {value}`. Do not add a real key to this repository, an issue, a prompt, or a log.

The [Baizhi integration repository](https://github.com/chaitin/baizhi-agent-toolkit) publishes the client configuration and documentation under MIT. It does not contain the hosted backend. The service terms, key permissions and possible charges are separate. This package does not set a tool allowlist; the actual tool set depends on the account and key. Some tools can consume credits or have side effects. Review the current tool list and usage limits in the console and in Vetta before use. Tool inputs leave Vetta for the hosted service, and the client may pass returned content to a model provider according to its settings.

Vetta stores installed MCP configuration through its existing settings mechanism. The secret input hides the key in the installation form; that alone is not a promise of encrypted storage. Use an appropriately scoped key and protect local configuration and backups. For setup or credential issues, follow the [upstream integration documentation](https://github.com/chaitin/baizhi-agent-toolkit) or contact Baizhi Cloud through its console.

The card image is an unmodified official Baizhi Cloud product mark. Its source and checksum are recorded in [BRAND-ASSET.md](BRAND-ASSET.md); the marketplace's MIT license does not transfer rights in that mark.
