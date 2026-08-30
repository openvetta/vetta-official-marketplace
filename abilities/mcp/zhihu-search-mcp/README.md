# Zhihu Search

Connect Vetta to search, direct answers and trending topics through
[zhihu-search](https://github.com/klarkxy/zhihu-search), a community-maintained client for the
Zhihu Open Platform. Pair it with **Zhihu Research Guide**, or use the tools independently.

## Setup

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) once and make `uvx`
   available on Vetta's PATH. Restart Vetta after a PATH change. Vetta does not provision uv.
2. Create an Access Secret at the [Zhihu developer console](https://developer.zhihu.com/).
3. Install this ability and enter the secret in the protected parameter dialog. It is injected
   into the server as `ZHIHU_ACCESS_SECRET`, not copied into CLI credentials.

Startup command: `uvx --from zhihu-search==2.0.0 zhihu-search serve --tools compact`.
First launch downloads the package and dependencies; it needs network access and Python 3.10+
(uv can obtain a compatible Python under its normal download policy). If a slow first download
times out in Vetta, run `uvx --from zhihu-search==2.0.0 zhihu-search --version` in your own terminal
to finish package preparation, then reconnect. That command makes no Zhihu business request.
No Node.js or source checkout is needed.

## Available tools

`search`, `ask`, `trending` and `other` are initially visible. The `other` switch can expand
low-frequency tools in the current session, including quota, user data, knowledge bases and
PDF/PPT tasks. This is not a read-only allowlist. Request additional workflows explicitly and
keep Vetta's normal approval policy. Local uploads and OAuth token exchange stay outside MCP.

Requests may consume Zhihu quota. Never paste credentials into prompts or logs. To diagnose a
missing command, check `uvx --version` locally; no real API call is needed to verify installation.

## Provenance

The Python package is used unchanged from [PyPI 2.0.0](https://pypi.org/project/zhihu-search/2.0.0/).
The top-level version is pinned; transitive dependencies are resolved by uv, not locked by this
marketplace. Upstream uses [SATA 2.0](https://github.com/klarkxy/zhihu-search/blob/2246138b8c04a7d1647beaf23381468f63aa1bfe/LICENSE),
including its star/thank-author condition. Thanks to Klarkxy. This is not a Zhihu-published client.
