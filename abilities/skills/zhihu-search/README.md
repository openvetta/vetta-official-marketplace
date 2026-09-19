# Zhihu Research Guide — integration notes

This document is for advanced setup, troubleshooting and maintainers. The Vetta detail page uses
[the product introduction](detail.json), with [a Chinese version](detail.zh.json), instead of displaying these technical notes.

Choose the right query for Chinese-community research: search for inspectable sources, direct
answers for synthesis, or trending topics for current discussions. Return useful attribution
and state when evidence is weak. Repository-local coding, translation and pure logic do not
trigger external requests unless the user explicitly requests external evidence.

## Use with Vetta

Install this guide directly or select it in **Zhihu Research**. Pair it with **Zhihu Search**
to reuse the visible `zhihu-search-mcp` tools without duplicate CLI calls. Installing the guide
alone does not install a server or provision Python/uv.

Standalone CLI use requires [uv](https://docs.astral.sh/uv/getting-started/installation/) on PATH,
Python 3.10+ (which uv can obtain), network access and separately configured credentials.
All CLI examples pin `zhihu-search==2.0.0`. The companion's secret is not automatically shared
with the CLI, and the guide must never read Vetta files to extract it. See
[setup and diagnostics](references/setup.md) for the two distinct credential paths.

User-data, knowledge-base, upload, PDF/PPT and OAuth workflows require an explicit user request.
Real queries may consume upstream quota; do not use a real query as an automatic health check.

## Attribution

Adapted from [Klarkxy's Skill](https://github.com/klarkxy/zhihu-search/tree/2246138b8c04a7d1647beaf23381468f63aa1bfe/skills/zhihu-search).
`upstream.json` records the exact revision and adaptation. The Python implementation is unchanged.
The [original SATA 2.0 license](LICENSE) is retained, including its star/thank-author condition.
Thanks to Klarkxy. This community project is not an official Zhihu client.
