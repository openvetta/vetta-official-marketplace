# Vetta Official Marketplace

Official ability marketplace for the Vetta desktop application's GitHub ability source.

The catalog is currently empty: `.vetta/marketplace.json` declares `"abilities": []`.

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

## Update rules

- Increment `marketplaceVersion` whenever repository marketplace content changes. The desktop client rejects a synced archive whose content changed without a version bump.
- Keep each catalog `slug` and `version` equal to its `SKILL.md` frontmatter.
- Increment `configVersion` when an ability's configuration contract changes.
- Slugs are unique across the whole manifest, not per type.
- Keep installation configuration in `mcp.json` / `plugin.json` and presentation resources in the same package's `ability.json`, detail file, and assets.
- Compose detail pages from the host-rendered block whitelist; never add executable HTML, JavaScript, CSS, iframe content, or custom actions.
- `minAppVersion` gates the whole marketplace: clients older than that version refuse to load this source.
