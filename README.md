# Vetta Official Marketplace

Official ability marketplace for the Vetta desktop application's GitHub ability source.

The catalog includes document skills, Notion, Cloudflare, Xiaohongshu, X API and
[Zhihu Research](abilities/bundles/zhihu-research/README.md). Zhihu Research combines a research
guide with a separately installable search connection, using `klarkxy/zhihu-search` without
modifying its Python implementation. Its MCP requires uv on PATH and a Zhihu Access Secret;
Vetta collects the secret during installation. This is not a zero-runtime-dependency integration.

The Feishu ability is a CLI Provider plugin. Enabling it asks Desktop to probe and, when needed,
install the official `@larksuite/cli`; its detail-page slot shows the real lifecycle and turns the
official CLI's opaque setup URL into a QR code. Agent work still goes through the existing shell and
the CLI's bundled skills—there is no Vetta Action, MCP server or replacement Agent tool in between.

The Notion ability connects directly to Notion's official hosted MCP endpoint. Users install it and
complete browser authorization for their own workspace; no developer application, integration
secret or local runtime is required.

[Cloudflare Developer Platform](abilities/bundles/cloudflare-developer-platform/README.md) is a
selectable bundle of three pinned official Cloudflare skills plus two Cloudflare-hosted MCP services.
It combines platform and Wrangler guidance, Workers review rules, public documentation search and
optional browser-authorized account operations. The bundle installs no local MCP runtime and does
not globally install Wrangler; account operations should use least privilege and explicit approval.

## Repository layout

```text
.vetta/marketplace.source.json
abilities/skills/<slug>/SKILL.md
abilities/mcp/<slug>/mcp.json
abilities/plugins/<slug>/plugin.json
abilities/bundles/<slug>/
abilities/<type>/<slug>/ability.json
abilities/<type>/<slug>/detail.json
abilities/<type>/<slug>/README.md
abilities/<type>/<slug>/assets/
```

The protected **marketplace-source** branch contains ability declarations and source code. The existing **main** branch remains an immutable schema v2 compatibility source for older Desktop builds. CI publishes immutable plugin packages to GitHub Releases and generates a schema v3 distribution on **gh-pages**. Desktop uses this repository with branch **gh-pages** after its first successful publication. The distribution contains presentation and installable Skill/MCP/Bundle content, without plugin source or build output.

This follows the [Helm chart-releaser model](https://github.com/helm/chart-releaser-action). See [the publication guide](docs/marketplace-v3.md). Legacy client refs must remain available until those clients are migrated.

## Create your own marketplace with an Agent

The [`create-vetta-marketplace`](https://github.com/openvetta/vetta-skills/tree/main/skills/create-vetta-marketplace)
Skill teaches an Agent how to create, validate, publish, and connect a GitHub based Vetta ability
marketplace using the same schema v3 release model as this repository. It covers Skills, MCP
servers, plugins, Bundles, immutable `.vettapkg` plugin assets, GitHub Actions checks, private
repositories, compatibility branches, and Desktop source configuration.

Install it with the [Vercel Skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add openvetta/vetta-skills --skill create-vetta-marketplace
```

Then give your Agent this Prompt, replacing the values in angle brackets:

```text
Use $create-vetta-marketplace to create my Vetta ability marketplace.

Create a <public-or-private> GitHub repository named <repository> under <owner>. Use marketplace
schema v3, main for source and gh-pages for distribution, and minimum Vetta Desktop version <x.y.z>. Set up the standard ability
layout for Skills, MCP servers, plugins, and Bundles; repository-level Agent instructions; and
GitHub Actions validation. Publish plugin runtime output as immutable .vettapkg GitHub Release
assets with SHA-256 metadata, and do not commit generated plugin archives or build output to the
marketplace source tree. Generate the index on gh-pages; do not create a second catalog PR or require manual marketplaceVersion updates.

Validate the generated repository with the Vetta Plugin CLI and the Desktop publication check,
push it to GitHub, then report the repository URL and the exact repository and branch values I
should add under Vetta Desktop -> Abilities -> Marketplace sources. Do not add sample abilities
unless I ask.
```

## Adding an ability

**Read [`AGENTS.md`](./AGENTS.md) first — it is the authoring manual for this repository (written in Chinese), and every rule in it maps to a hard validation in the desktop client.**

If you are an AI agent working in this repository, `AGENTS.md` is your instruction file: follow it end to end rather than inferring the format from existing packages.

1. Add source and presentation files under abilities/.
2. Register the ability in .vetta/marketplace.source.json. Plugins declare minAppVersion; CI generates releases metadata.
3. Increase the ability version when ready to publish runtime changes.
4. Submit a normal PR. Checks validate the source and build a candidate; a maintainer reviews it.
5. After merge into marketplace-source, CI builds unpublished versions, uploads verified Release assets, then updates gh-pages.

Merging a version change permits publication. Configure marketplace-source with required reviews and the marketplace-source check. The publisher has Contents: Write for Releases and gh-pages; it never writes generated changes to marketplace-source or main. It does not need permission to create PRs. Keep main on the legacy schema v2 snapshot while supported Desktop versions still reference it.

Existing package versions are immutable. Repeated runs verify uploaded bytes, and a failed upload/check leaves the previous index available.

For bundle-only members, `ability.json` also owns catalog metadata: name, description, version,
configVersion, category, categoryI18n and tags. Translated names/descriptions/tags may share
`detail.i18n.zh` with a README path. Keep installation configuration in the type-specific package
file, never in `ability.json`. For independently listed entries, existing catalog/presentation
precedence remains unchanged. Bare `{ type, slug }` references still require a top-level entry.

Member type/slug must match the reference; version must match the package file. Multiple bundles
can share one member, but the same slug cannot refer to different types or paths. Invalid content
fails the whole source; the client reports `sync-failed` and retains a usable previous snapshot.

## Validation and versions

- Keep slugs and package versions consistent. Raise configVersion only for configuration contract changes.
- Source development and root documentation edits do not publish runtime changes. Increase an ability version to publish them.
- Plugin history is retained in the generated distribution for older compatible Desktop versions.
- CI assigns marketplaceVersion only when distributed content changes. Never manually edit gh-pages or overwrite a Release asset.
- Presentation changes may update the generated index without rebuilding an unchanged plugin version.
- Existing sources are not silently redirected; switch Desktop to gh-pages explicitly after validating the first publication.

Run with Node.js 22.21.1+ and Python 3:

```bash
node scripts/marketplace.mjs check
node --test tests/*.test.mjs
node scripts/marketplace.mjs build
```

Use a fresh output directory for each build (`--output DIR`). For incremental builds pass `--previous <gh-pages-checkout>`. On Windows with a Python shim, set VETTA_PYTHON to the actual python.exe. Local build never uploads anything.

## Writing for Vetta users

Detail pages explain the outcome, show a conversation example and describe a short Vetta workflow.
Keep command lines and integration internals in linked technical notes, not in the primary detail
page. Disclose real prerequisites, credential requirements and important limits before the user
starts; do not promise automatic setup the client does not provide. The bilingual Zhihu detail
files demonstrate this separation, with content regression tests for the user-facing contract.

## Third-party licenses

The root license does not replace third-party package licenses. The adapted Zhihu guide retains
the upstream [SATA 2.0 license](abilities/skills/zhihu-search/LICENSE) and
[provenance](abilities/skills/zhihu-search/upstream.json). Review its star/thank-author condition
before redistribution. Thanks to Klarkxy; this repository does not act on a user's GitHub account.

The Cloudflare skills retain the upstream Apache-2.0 license and record their exact source paths and
pinned revision in package-level `upstream.json` files, beginning with
[Cloudflare Platform provenance](abilities/skills/cloudflare/upstream.json). The brand assets and
skill content come from Cloudflare's official repository; marketplace metadata and bilingual detail
pages are Vetta adaptations.
