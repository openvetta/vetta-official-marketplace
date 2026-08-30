# Vetta setup and diagnostics

Read this only for setup, credentials or diagnostics. For ordinary research, follow `SKILL.md`.

## Install through Vetta

Choose Zhihu Research in the ability marketplace, then select the guide, the search connection,
or both. Do not install a second global Skill or register another server through another client.
This guide alone does not install a runtime or an MCP server.

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) if `uvx` is missing, and
restart Vetta after a PATH change. Python 3.10+ is required; uv can download a compatible Python
under its normal policy. First use downloads the pinned package and dependencies. No Node.js
is needed for this Vetta package.

## Companion MCP credentials

Create an Access Secret at https://developer.zhihu.com/ and enter it in Vetta's protected MCP
parameter dialog. Vetta passes `ZHIHU_ACCESS_SECRET` only to the companion server process.
These credentials are not shared with standalone CLI commands. Never inspect Vetta configuration
to obtain them, export them into a shell, or ask the user to paste them into chat.

Use the visible tools belonging to `zhihu-search-mcp`. If it is disabled, disconnected or awaiting
configuration, ask the user to configure/enable that connection in Vetta; do not silently bypass
it with a CLI invocation. Do not auto-approve tools or create a duplicate MCP registration.

## Standalone guide credentials

Only when the user chose standalone CLI use, let the user configure `ZHIHU_ACCESS_SECRET` in
their own local environment or use the upstream local credential-storage mechanism in their
own terminal. Do not put secrets in agent-generated commands, chat, source files or logs.
Do not promise that the secret entered in Vetta is available in a separate shell.

Non-business diagnostics:

```bash
uvx --version
uvx --from zhihu-search==2.0.0 zhihu-search --version
uvx --from zhihu-search==2.0.0 zhihu-search --check-token
```

The last two commands may download packages on first use but do not make a Zhihu business query.
`--check-token` reports status and source, not a secret fragment or a user-specific credential path.
Never run the bare executable without a subcommand: it starts a persistent server.

## Troubleshooting and optional tools

The MCP command is `uvx --from zhihu-search==2.0.0 zhihu-search serve --tools compact`. Its initial catalog contains
`search`, `ask`, `trending` and `other`; `other` can expand low-frequency tools for that session.
Only request such tools for explicit user-data, quota, knowledge-base or office workflows.
Do not confuse a compact catalog with a permissions boundary.

Use `--probe` only after the user authorizes a real upstream check: it performs a real hot-list
request and can consume quota. Do not run it as an automatic install check or repeated health poll.
Do not change or remove any existing user registration without the user's authorization.
