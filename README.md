# Vetta Official Marketplace

Official ability marketplace for the Vetta desktop application's GitHub ability source.

The catalog includes document skills and the `xiaohongshu-mcp` managed MCP Ability.

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

Supported ability types are `skill`, `mcp`, `plugin`, and `bundle`. Bundle members may only reference `skill`, `mcp`, or `plugin` entries declared in the same manifest.

## Adding an ability

**Read [`AGENTS.md`](./AGENTS.md) first — it is the authoring manual for this repository (written in Chinese), and every rule in it maps to a hard validation in the desktop client.**

If you are an AI agent working in this repository, `AGENTS.md` is your instruction file: follow it end to end rather than inferring the format from existing packages.

The short version:

1. Pick a type: `skill`, `mcp`, `plugin`, or `bundle`.
2. Create the package directory (`abilities/skills/<slug>/`, `abilities/mcp/<slug>/`, `abilities/plugins/<slug>/`, `abilities/bundles/<slug>/`) and add the package file that type requires (`SKILL.md`, `mcp.json`, or `plugin.json`).
3. Add presentation files: `ability.json`, optionally `detail.json` and `assets/`.
4. Register the entry in `.vetta/marketplace.json` under `abilities[]`.
5. Bump the top-level `marketplaceVersion`.
6. Work through the checklist at the end of `AGENTS.md`, then add this repository as a marketplace source in the desktop app and verify the ability installs.

Slug and version must match exactly across three places: the catalog entry, the package file, and `ability.json`. A mismatch fails the whole source, and the desktop client reports only `sync-failed` without a reason — so verify locally instead of guessing.

## Update rules

- Increment `marketplaceVersion` whenever repository marketplace content changes. The desktop client rejects a synced archive whose content changed without a version bump.
- Keep each catalog `slug` and `version` equal to its `SKILL.md` frontmatter.
- Increment `configVersion` when an ability's configuration contract changes.
- Slugs are unique across the whole manifest, not per type.
- Keep installation configuration in `mcp.json` / `plugin.json` and presentation resources in the same package's `ability.json`, detail file, and assets.
- Managed binary MCP packages may declare a `schemaVersion: 2` runtime with HTTPS release assets and SHA-256 checksums; they must not execute install scripts.
- Compose detail pages from the host-rendered block whitelist; never add executable HTML, JavaScript, CSS, iframe content, or custom actions.
- `minAppVersion` gates the whole marketplace: clients older than that version refuse to load this source.
