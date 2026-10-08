# CLIProxyAPI for Vetta

This marketplace plugin runs pinned CLIProxyAPI release assets as a Vetta-managed loopback service. All
CLIProxyAPI-specific management routes, OAuth provider definitions, account aggregation and model protocol mapping
live in this package; the Desktop host only provides generic service and owned-model APIs.

The plugin supports OAuth for Gemini CLI, OpenAI Codex, Claude Code, Google Antigravity, Kimi Code (kimi.com), xAI, Meta Muse Code, Devin and Kimi Code (kimi.ai). It
discovers live routes from `/v1/models` and publishes Google, Anthropic, Responses and compatible Completions model
providers in the plugin-owned namespace. The model picker groups credentials into supplier pools: one route is shown
once per supplier and protocol, while every matching enabled credential remains available to CPA for balancing and
failover. Image-capable routes are excluded from text providers and exposed as individual Vetta image models. OpenAI
routes use CPA's Images API; Google and Antigravity routes use `generateContent`, including scoped input reads for
image-to-image requests. Returned images are stored as Vetta-managed artifacts.

Routing uses CPA session affinity. Main responses, automatic titles and other model calls that carry the same Vetta
conversation identity stay on one healthy account; CPA may rebind the conversation only when that credential becomes
unavailable. Subagents explicitly inherit the parent account (`session-affinity-subagents: true`). This prevents a single user turn from appearing as simultaneous traffic on multiple accounts of the same
provider while preserving normal account-level failover.

Runtime updates are made by changing the fixed release URLs in `runtime-lock.json` and matching SHA-256 values in both
the lock and `plugin.json`, rebuilding `dist/`,
and releasing a new plugin patch after the six-platform combined canary passes. Runtime installation never follows
`latest`, and no upstream binaries are stored in this marketplace repository.

See [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) and the separately versioned
[Gemini CLI provider](https://github.com/router-for-me/cpa-plugin-gemini-cli).

From the repository root, `node scripts/update-cli-proxy-api.mjs` reports newer stable upstream releases (exit 2 means
an update is available). `check-cli-proxy-api-upstream.yml` runs this read-only check daily. It does not create a PR.
`--write` downloads and verifies all twelve platform assets and updates the runtime lock and provenance.
It preserves the plugin version and all package/catalog identity versions. For a new batch of distribution changes,
advance the plugin version once if it still matches the published version; otherwise keep the existing pending version.
Reuse that version for all further edits, tests and local installs until the batch is published. The distribution version remains
CI-owned. Explicit `--core-version` and `--gemini-version` select a reviewed stable release; a major upgrade also requires
`--allow-major`. Downgrades and changed hashes at unchanged asset URLs are rejected. For example:

```bash
node scripts/update-cli-proxy-api.mjs --core-version 8.0.17 --gemini-version 1.0.5 --allow-major --write
```

Runtime updates go through a normal source PR into `main`. `cli-proxy-api-runtime.yml` runs plugin checks and the real
core/Gemini combination on all six supported platforms. It never merges or publishes a PR automatically.

### CPA 8 integration

The current development source pins CPA 8.0.17 and Gemini CLI 1.0.5. Core management calls use `/v8/management`, including the shared
`oauth/auth-url?provider=...` route. Codex, Claude and Antigravity retain `is_webui=true` for callback forwarding; Devin uses CPA's direct loopback callback. Meta and Kimi.ai use device authorization.
The config template uses the v8 sections: `server`, `management`, `access`, `oauth`, `requests`, `observability`, and
`routing.retry`. Client keys belong to `access.api-keys`, not the upstream-provider `api-keys` groups. Retries remain
disabled with a single credential attempt; Antigravity credit spending remains disabled. Obsolete quota-switch flags
have no active v8 equivalent and are omitted. Auth data and saved Vetta model selections retain their existing paths.

Meta Muse Code, Devin and Kimi.ai have separate login entries and model channels. Credentials expose
per-model/account cooldowns and an explicit refresh action. Refreshed token payloads are discarded by the plugin.
Quota discovery prefers enabled v8 provider plugins; CPA retains `/v0/management/quota/fetch` for generic/declarative
probes. Existing Codex/Antigravity probes remain fallbacks. The plugin does not install quota plugins automatically.
Normalized quota supports grouped limits and numeric/currency summaries. Unknown or failed quota is never treated as unlimited.

Model input modalities and `native_capabilities.web_search` are read from upstream data. Only text/image inputs are
published to the current Vetta chat contract. Desktop 0.5.61 development changes and the pending SDK input declaration add preservation of
`input` at the model write boundary; older hosts silently omit it. This plugin remains compilable with published SDK
0.3.10 and preserves input during read-back without importing host source. Audio/video/file and native search labels
are informational: this change does not add corresponding Vetta attachment or native tool APIs. Do not infer support
from model names. Account entitlements still determine the routes actually available.

From the repository root, run the isolated binary canary with Python 3.9 or later:

```bash
python3 scripts/test-cli-proxy-api-runtime.py
# On Apple Silicon, additionally validate the x64 artifacts with Rosetta:
python3 scripts/test-cli-proxy-api-runtime.py --rosetta
```

It downloads only the locked assets for the current platform and verifies their SHA-256 before starting CPA in a
temporary directory. A loopback mock upstream exercises Completions, Responses, Messages, generateContent, SSE,
stream cancellation, image input, tool calls, restart persistence and single-attempt failures; management checks cover the v8 config, model catalogs, credential operations,
and API-call quota transport. Temporary data and processes are cleaned up. Real provider OAuth, quota responses,
and image generation still require account-backed acceptance tests before release. Mac x64 under Rosetta checks the x64 binaries, not Intel hardware; Windows/Linux native checks are configured in CI and must run before claiming those platforms passed.

Development checks: run `npm install`, `npm run check`, `npm run test`, and `npm run build` in this directory.
The configuration template, bilingual details and provenance files are emitted into `dist/assets`, so the ZIP
contains every manifest resource even with the currently published packaging tool. The tool still warns about its
default `@vetta/ui` shared entry; this plugin does not import that unavailable package and uses its own small controls.

The host must implement Plugin API 2.4.0. The plugin declares semantic readiness: Desktop keeps the service in
`starting` after the loopback health endpoint responds, and the plugin reports `ready` only after account-backed model
routes are usable. This prevents an early empty `/v1/models` response from erasing the persisted provider snapshot.
The selected published routes are stored in the plugin-private `published-models.json` file through the generic
storage file API. Route keys include their protocol so identical bare model IDs never select each other. The explicit
`all` mode follows models discovered later, while a custom selection remains stable. Version 1 selections migrate only
after a complete catalog read; missing storage and an empty selection remain distinct states, and updates replace the
file atomically.
`src/runtime-contract.ts` describes the consumed public API and legacy-host read-back compatibility, without importing
Desktop source files. Development types and the manual use SDK 0.3.10; the runtime still requires Plugin API 2.4.0.
Runtime configuration is regenerated in the cache directory for each launch; credentials and OAuth accounts remain
in the data directory. API-key configuration forms are not exposed by this plugin. Disabling the plugin stops
the service but retains model settings; re-enabling refreshes their endpoint, without changing the default model.
Credentials are managed on the CPA setup workspace view, not on the ability page: it authorizes new accounts, lists
each credential with its own request health, switches one in or out of the routing pool, refreshes credentials, clears cooldown state and removes
file-backed local credentials with explicit confirmation. Local removal does not revoke the provider-side OAuth grant;
runtime-only credentials must be removed from their backing store. The ability-detail panel keeps only the managed
service's own state — install, start, restart and model sync — and a link into that view, so a single surface owns the
gateway's credentials.

The plugin, not Desktop, owns runtime downloads: it selects the current platform via `ctx.services.getPlatform()`,
fetches each pinned URL through its declared `ctx.network` hosts, verifies SHA-256, and submits the archive bytes to
`ctx.services.install()`. Desktop never reads a release URL; it only applies generic archive limits, verifies the
manifest digest again, atomically installs the version, and supervises the process.

### Local validation (2026-10-07)

The darwin-arm64 core 8.0.17 + Gemini 1.0.5 combination passed the isolated canary, including all eleven model channels,
four text protocol adapters, SSE cancellation, image input forwarding, tools, single-attempt errors and restart persistence.
The darwin-x64 combination **failed under Rosetta** at `GeminiCLIPluginCall`, with Go runtime
`unexpected return pc for runtime.cgocallback`. Reproduced with and without `GODEBUG=asyncpreemptoff=1`.
The upstream loader offers in-process dynamic libraries, not a configurable subprocess fallback. No runtime workaround
has been applied. This result does not establish whether native Intel macOS is affected; its native CI job must pass
before release. Windows/Linux execution has not been validated locally. New provider authorization and provider-backed
quota/image generation still need accounts; mocked contracts do not prove those end-to-end flows.
