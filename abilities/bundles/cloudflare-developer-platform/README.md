# Cloudflare Developer Platform — integration notes

This document covers package selection, setup and security boundaries. Vetta's detail page uses
[a user-facing introduction](detail.json), with [a Chinese version](detail.zh.json).

The bundle brings together three official Cloudflare skills and two Cloudflare-hosted MCP services.
Only the bundle appears in marketplace discovery; every member keeps a stable identity and remains
independently selectable, installable, removable and switchable in Vetta.

## Choose what to install

- **Cloudflare Platform**: broad, retrieval-first guidance across Workers, Pages, storage, AI,
  networking, security and infrastructure as code.
- **Wrangler**: current command and configuration guidance for the official project-local CLI.
- **Workers Best Practices**: production review rules for Workers code and configuration.
- **Cloudflare Documentation**: public documentation search through Cloudflare's hosted MCP service;
  no sign-in, credential or local runtime is required.
- **Cloudflare API**: broad account operations through Cloudflare's hosted Code Mode MCP service;
  this member requires browser authorization.

Install the first four for development and read-only research without account authorization. Add
Cloudflare API only when Vetta must inspect or change resources that are not available through your
project's existing Wrangler session.

## Runtime and authorization

The MCP members use Streamable HTTP at `https://docs.mcp.cloudflare.com/mcp` and
`https://mcp.cloudflare.com/mcp`. They do not install a local executable and do not ask for an API
token in Vetta. Cloudflare Documentation is public. Cloudflare API starts Cloudflare's browser OAuth
flow; choose the smallest useful account, resource and action scope.

Wrangler is not installed globally by this package. The skill follows the repository's package
manager and uses the project-local Wrangler dependency. A project that does not yet include it may
need Node.js, network access and an explicit dependency installation before commands can run.

## Safety boundary

Skills provide instructions; they do not auto-run deployments or bypass Vetta's normal command and
tool confirmations. Wrangler and Cloudflare API can change live DNS, deployments, storage, security
configuration and other account resources. Some operations can incur charges. Prefer test resources,
least-privilege authorization and read-only inspection first, then review the exact target before a
write, deployment or deletion.

Cloudflare's Code Mode service presents a compact API search-and-execute surface. Generated
orchestration code runs in an isolated Cloudflare Worker under service-controlled outbound access,
not as code installed locally by this marketplace package.

## Upstream and license

The three skills are vendored from [`cloudflare/skills`](https://github.com/cloudflare/skills) at
commit `f96bff754e428838818017f75817f0f9428acd48`. Their upstream source and Apache-2.0 license are
preserved in each package; Vetta adds package metadata, bilingual product details, the upstream
version and the official Cloudflare logo. The hosted services remain governed by Cloudflare's terms
and the permissions granted during authorization.
