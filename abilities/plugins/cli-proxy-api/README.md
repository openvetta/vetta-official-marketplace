# CLIProxyAPI for Vetta

This marketplace plugin runs pinned CLIProxyAPI release assets as a Vetta-managed loopback service. All
CLIProxyAPI-specific management routes, OAuth provider definitions, account aggregation and model protocol mapping
live in this package; the Desktop host only provides generic service and owned-model APIs.

The first release supports OAuth for Gemini CLI, OpenAI Codex, Claude Code, Google Antigravity, Kimi and xAI. It
discovers live routes from `/v1/models` and publishes Google, Anthropic, Responses and compatible Completions model
providers in the plugin-owned namespace.

Runtime updates are made by changing the fixed release URLs in `runtime-lock.json` and matching SHA-256 values in both
the lock and `plugin.json`, rebuilding `dist/`,
and releasing a new plugin patch after the six-platform combined canary passes. Runtime installation never follows
`latest`, and no upstream binaries are stored in this marketplace repository.

See [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) and the separately versioned
[Gemini CLI provider](https://github.com/router-for-me/cpa-plugin-gemini-cli).

`node scripts/update-cli-proxy-api.mjs` reports newer stable upstream releases. `--write` downloads and verifies all
twelve platform assets, advances the package and marketplace versions, and updates the lock. The scheduled workflow
then rebuilds `dist/`, runs marketplace tests and opens a review PR; it never merges automatically.

Development checks: run `bun install`, `bun run check`, `bun run test`, and `bun run build` in this directory.
The configuration template, bilingual details and provenance files are emitted into `dist/assets`, so the ZIP
contains every manifest resource even with the currently published packaging tool. The tool still warns about its
default `@vetta/ui` shared entry; this plugin does not import that unavailable package and uses its own small controls.

The host must implement Plugin API 2.0.0. The plugin declares semantic readiness: Desktop keeps the service in
`starting` after the loopback health endpoint responds, and the plugin reports `ready` only after account-backed model
routes are usable. This prevents an early empty `/v1/models` response from erasing the persisted provider snapshot.
The selected published model IDs are stored in the plugin-private `published-models.json` file through the generic
storage file API. Missing storage and an empty selection are distinct states; updates replace the file atomically.
Until the matching SDK is published,
`src/runtime-contract.ts` describes only the consumed public API, without importing Desktop source files.
Runtime configuration is regenerated in the cache directory for each launch; credentials and OAuth accounts remain
in the data directory. API-key configuration forms are not part of this first release. Disabling the plugin stops
the service but retains model settings; re-enabling refreshes their endpoint, without changing the default model.
Credentials are managed on the CPA setup workspace view, not on the ability page: it authorizes new accounts, lists
each credential with its own request health, switches one in or out of the routing pool, clears quota state and removes
file-backed local credentials with explicit confirmation. Local removal does not revoke the provider-side OAuth grant;
runtime-only credentials must be removed from their backing store. The ability-detail panel keeps only the managed
service's own state — install, start, restart and model sync — and a link into that view, so a single surface owns the
gateway's credentials.

The plugin, not Desktop, owns runtime downloads: it selects the current platform via `ctx.services.getPlatform()`,
fetches each pinned URL through its declared `ctx.network` hosts, verifies SHA-256, and submits the archive bytes to
`ctx.services.install()`. Desktop never reads a release URL; it only applies generic archive limits, verifies the
manifest digest again, atomically installs the version, and supervises the process.
