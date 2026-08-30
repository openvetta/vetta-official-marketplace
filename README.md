# Vetta Official Marketplace

Official ability marketplace for the Vetta desktop application's GitHub ability source.

The catalog includes document skills, Xiaohongshu, X API and
[Zhihu Research](abilities/bundles/zhihu-research/README.md). Zhihu Research combines a research
guide with a separately installable search connection, using `klarkxy/zhihu-search` without
modifying its Python implementation. Its MCP requires uv on PATH and a Zhihu Access Secret;
Vetta collects the secret during installation. This is not a zero-runtime-dependency integration.

## Repository layout

```text
.vetta/marketplace.json
abilities/skills/<slug>/SKILL.md
abilities/mcp/<slug>/mcp.json
abilities/plugins/<slug>/plugin.json
abilities/bundles/<slug>/
abilities/<type>/<slug>/ability.json
abilities/<type>/<slug>/detail.json
abilities/<type>/<slug>/README.md
abilities/<type>/<slug>/assets/
```

Supported ability types are `skill`, `mcp`, `plugin`, and `bundle`. With manifest schema v2, bundle
members may reference `skill`, `mcp`, or `plugin` packages via `source.path`, relative to the marketplace
root. Only top-level `abilities[]` entries are independently listed. Bundle-only members remain
viewable and selectable inside their bundle, and manageable under My Abilities once installed.
The Zhihu catalog lists only Zhihu Research; its two member packages are not separately promoted.

This format needs the Desktop build implementing schema v2 (target version `0.5.49`). Updating an
old build's catalog alone does not update its parser: old clients reject this source and retain
available old cached content. Update the client before switching the source to v2.

## Adding an ability

**Read [`AGENTS.md`](./AGENTS.md) first — it is the authoring manual for this repository (written in Chinese), and every rule in it maps to a hard validation in the desktop client.**

If you are an AI agent working in this repository, `AGENTS.md` is your instruction file: follow it end to end rather than inferring the format from existing packages.

The short version:

1. Pick a type: `skill`, `mcp`, `plugin`, or `bundle`.
2. Create the package directory (`abilities/skills/<slug>/`, `abilities/mcp/<slug>/`, `abilities/plugins/<slug>/`, `abilities/bundles/<slug>/`) and add the package file that type requires (`SKILL.md`, `mcp.json`, or `plugin.json`).
3. Add presentation files: `ability.json`, optionally `detail.json` and `assets/`.
4. Register in top-level `abilities[]` for independent discovery, or reference a bundle-only package using `{ type, slug, source: { path } }` in a bundle's members.
5. Bump the top-level `marketplaceVersion`.
6. Work through the checklist at the end of `AGENTS.md`, then add this repository as a marketplace source in the desktop app and verify the ability installs.

For bundle-only members, `ability.json` also owns catalog metadata: name, description, version,
configVersion, category, categoryI18n and tags. Translated names/descriptions/tags may share
`detail.i18n.zh` with a README path. Keep installation configuration in the type-specific package
file, never in `ability.json`. For independently listed entries, existing catalog/presentation
precedence remains unchanged. Bare `{ type, slug }` references still require a top-level entry.

Member type/slug must match the reference; version must match the package file. Multiple bundles
can share one member, but the same slug cannot refer to different types or paths. Invalid content
fails the whole source; the client reports `sync-failed` and retains a usable previous snapshot.

## Update rules

- Increment `marketplaceVersion` whenever repository marketplace content changes. The desktop client rejects a synced archive whose content changed without a version bump.
- Keep each catalog `slug` and `version` equal to its `SKILL.md` frontmatter.
- Increment `configVersion` when an ability's configuration contract changes.
- Slugs are unique across the resolved catalog, not per type. Listing or unlisting a member does not change its identity, version or configuration version; bump marketplaceVersion for the catalog change.
- Display names describe the capability, not its technical type: do not append MCP, Skill,
  Plugin or Bundle (or their Chinese equivalents). Keep existing slugs stable when renaming.
- Keep `category` as the stable grouping identity and provide matching `categoryI18n.zh` / `categoryI18n.en`
  labels on every categorized entry. Desktop switches group labels with the app language; older clients simply
  keep displaying `category`. This optional metadata does not require an ability version or `minAppVersion` bump,
  but the catalog change still requires a new `marketplaceVersion`.
- Keep installation configuration in `mcp.json` / `plugin.json` and presentation resources in the same package's `ability.json`, detail file, and assets.
- Managed binary MCP packages may declare a `schemaVersion: 2` runtime with HTTPS release assets and SHA-256 checksums; they must not execute install scripts.
- Compose detail pages from the host-rendered block whitelist; never add executable HTML, JavaScript, CSS, iframe content, or custom actions.
- `minAppVersion` gates the whole marketplace: clients older than that version refuse to load this source.

## Local validation

Run the dependency-free catalog regression tests with Node.js 20 or later:

```bash
node --test tests/marketplace.test.mjs
```

These tests cover package identities, referenced presentation files, bilingual categories,
display names, bundle membership and the Zhihu command/credential contract. They do not replace
the Desktop's full schema and archive validation or make real upstream API calls.

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
