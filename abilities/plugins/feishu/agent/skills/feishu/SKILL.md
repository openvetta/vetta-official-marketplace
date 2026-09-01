---
name: feishu
description: Use the official lark-cli for Feishu documents, messages, calendars, Base, tasks and other supported domains.
version: 1.0.0
---

# Feishu through the official CLI

Use `lark-cli` directly through the existing shell. Do not invent a Vetta tool or MCP layer around it.

Before performing a task, discover the official guidance shipped with the installed CLI:

1. Run `lark-cli skills list` to find the relevant official skill.
2. Run `lark-cli skills read <skill-name>` and follow the returned instructions.
3. Inspect unfamiliar commands with `lark-cli inspect <command>` before executing them.
4. Use `lark-cli auth status` when a command requires a user identity and authorization is uncertain.

Never reconstruct, shorten, or modify opaque authentication and configuration URLs emitted by the CLI.
