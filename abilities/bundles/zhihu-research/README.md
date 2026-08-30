# Zhihu Research

Research Chinese-community opinions, product experiences and current discussions with
[Klarkxy's zhihu-search](https://github.com/klarkxy/zhihu-search), a community-maintained client
for the Zhihu Open Platform, not a Zhihu-published application.

## Choose what to install

- **Zhihu Research Guide**: a Skill that chooses search, direct answers or trending topics and
  returns sources. It reuses the companion tools when available, without duplicate CLI requests.
- **Zhihu Search**: a local stdio MCP server providing those tools. Its default `compact` profile
  exposes `search`, `ask`, `trending` and the session-local `other` switch.

Select both for guided research, or select either member independently. This bundle has no server
process or credentials of its own; Vetta's existing member-selection dialog controls installation.
Members remain independently installable, removable and switchable.
Only Zhihu Research is listed in discovery. Open its member details to inspect either package;
installed members remain available under My Abilities for updates, removal and enable/disable.

## Before the first query

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and ensure `uvx` is on the
   PATH visible to Vetta. Restart Vetta after changing PATH. Vetta does not install uv for you.
2. Create an Access Secret in the [Zhihu developer console](https://developer.zhihu.com/).
3. Install the selected members. If you selected Zhihu Search, enter the secret in Vetta's protected
   parameter field, not in chat. The server receives it as `ZHIHU_ACCESS_SECRET`.
4. Ask a focused question, for example: “Find Chinese developer discussions about RAG evaluation
   and include three source links.”

The server runs `uvx --from zhihu-search==2.0.0 zhihu-search serve --tools compact`. uv downloads the pinned Python
package and its dependencies on first launch; a compatible Python (3.10 or later) is required and
uv can obtain one under its normal Python-download policy. First use requires network access to
package sources and can take longer. No Node.js, manual repository clone, global Python package
installation or marketplace-provided install script is required.

## Credentials and scope

Installing only the guide requires separately configured CLI credentials; the MCP secret is not
shared with standalone CLI processes. The guide must never extract credentials from Vetta's files.
If the companion is disabled or disconnected, configure it in Vetta instead of bypassing it.

Search, answers and trending requests can consume upstream quota. `compact` is a small initial
tool catalog, **not a read-only permission boundary**: `other` can reveal user-data, knowledge-base,
PDF/PPT and quota tools for the current session. Use those only on an explicit user request.
Local uploads and OAuth token exchange are not exposed as MCP tools. Vetta's normal tool approval
policy remains in effect; this package does not auto-approve tools.

## Upstream and license

The Python implementation is used unchanged from PyPI 2.0.0. The Skill is adapted for Vetta from
upstream commit `2246138b8c04a7d1647beaf23381468f63aa1bfe`; its package records the provenance and
preserves the SATA 2.0 license. Thanks to Klarkxy. Review the upstream license, including its
star/thank-author condition, before redistribution; this integration does not star repositories
on the user's behalf.
