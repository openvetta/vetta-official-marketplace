# Web Access — working notes

This directory is one marketplace plugin. Read the SDK handbook first; it ships with the
installed SDK and is the contract this code compiles against:

```bash
npx vetta-plugin-cli docs
```

## Layout

```text
src/
  index.tsx                     plugin assembly only: store, tools, view, detail slot
  domain/                       protocol shapes, settings schema, HTML extraction, URL guard
  services/                     host network adapter, provider calls, settings + secrets store
  tools/                        web_search / web_fetch registrations
  features/settings/            workspace view, hooks, form components
  features/setup/               ability-detail card that links to the settings view
  test/                         vitest suites (jsdom)
```

Rules that matter here:

- `plugin.json` needs `network.allowedHosts` for `network.fetch`; this plugin declares `["*"]`
  because search results and user-supplied instances are arbitrary hosts.
- Secrets go through `ctx.secrets`, settings through `ctx.storage`. Never put a key in
  `settings.json` or in a tool result.
- Tool handlers read the live store; do not snapshot settings into the registration.
- Every failure path that reaches the UI calls `ctx.ui.notify({ message, error })`.

## Commands

```bash
npx tsc --noEmit
npx vitest run
npx vite build
node ../../../tests/marketplace.test.mjs   # content regression, from the repository root
```

Only one capability version bump per unreleased batch; build output stays out of git.
