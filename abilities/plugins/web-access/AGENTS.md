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
  features/settings/            workspace view, hooks, host-component rows
  features/setup/               ability-detail card that links to the settings view
  test/                         vitest suites (jsdom)
```

Rules that matter here:

- The workspace page draws no controls of its own: settings chrome comes from
  `@vetta-org/theme-ui/plugin-ui` (`SettingSection` / `SettingRow` / `MotionSelect`) and
  primitives from `@vetta-org/ui` (`Stepper` / `Switch` / `Input` / `Button` / `Dialog`).
  Local code only arranges layout and passes copy — do not reintroduce a hand-built
  stepper, switch, select, card or row. Both entries need `hostUi` + `hostThemeUi` in
  `vite.config.ts` so they stay external and come from the app singleton.
- One column, and no save button: `useWebAccessSettings` writes every edit on its own
  (coalesced over 300 ms, flushed on unmount). Adding a form-level save step would put
  the burden back on the user; only secrets need an explicit confirm, because they open
  a dialog.
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
