# REA

Vetta plugin for [REA](https://github.com/morluto/rea) (Reverse Engineer Anything).

REA itself is a CLI plus an MCP server. This plugin adds the part a chat transcript
cannot hold: a durable **case** per investigation — target, route, goal, evidence
with its pointers, and the questions still open — plus the exports that leave the
session as files.

## What is in the box

| Layer | File | Responsibility |
| --- | --- | --- |
| Manifest | `plugin.json` | Permissions, the bundled `rea` MCP server, the contributed investigator agent, the skill |
| Case model | `src/domain/case-model.ts` | Types and pure transitions: create, append evidence, grade counts, trim, parse stored data |
| Evidence normalizer | `src/domain/evidence-normalizer.ts` | Turns a tool response into a claim line, anchors, fingerprint and excerpt |
| Routes | `src/domain/route-catalog.ts` | Which route a target takes, which engines it needs, first probe to run |
| Persistence | `src/services/case-store.ts` | `cases/<id>.json` + materialised `index.json`, published with one `commit()` |
| Engine checks | `src/services/readiness-probe.ts` | Local Node/npm/engine detection for `case_open`, cached a minute |
| Agent tools | `src/tools/` | `case_open`, `case_record`, `case_status`, `case_report` |
| Hook | `src/hooks/register-evidence-hook.ts` | `PostToolUse` / `PostToolUseFailure` → evidence entry, automatically |
| Intake | `src/features/target-intake/` | Two file-tree menu entries (files, and bundle directories) that start a conversation |
| Agent assets | `agent/skills/rea-investigation`, `agent/agents/rea-investigator.md` | The discipline and the persona |

## Shape

No React, no stylesheet, no navigation entry. The bundle the host loads is the
activation function: four agent tools, two hooks, one file-tree action. Anything
that would render belongs to the agent's own answer, not to the plugin.

## Icons

`assets/icon.png` (the REA artwork) is both the plugin identity (`plugin.json#icon`)
and the marketplace card (`ability.json#icon`). The plugin contributes no navigation
entry, so there is no monochrome sidebar glyph to maintain.

## Targets in the file tree

Two contributions, because the host matches one `resourceType` per contribution:

| Menu | Matches | Why |
| --- | --- | --- |
| file | `app exe dll dylib so node asar elf bin sys efi ko macho pyc dex jar class apk aab xapk apks ipa pck unity3d gguf safetensors cubin ptx wasm har saz pcap pcapng ips sqlite3 dmg pkg msi crx xpi` | the actual bytes |
| directory | `app framework appex xpc` | a macOS `.app` is a folder; matching it as a file never fires |

Deliberately excluded: generic archives (`zip`, `tar`, `gz`), extensionless
binaries, and over-broad suffixes (`dat`, `db`) — they would put the entry on
unrelated files and start an investigation REA cannot take anywhere.

The list is a *starting point for the agent*, not a capability claim. `.dmg`,
`.pkg`, `.msi`, `.crx` and `.xpi` need mounting or unpacking first; the plugin does
neither, and the prompt asks the agent to say what it needs instead of guessing.

## Data

Cases live in the plugin's private storage (`~/.vetta/plugin-data/rea/`), not in the
user's repository:

```text
index.json            # case summaries for the rail
state.json            # last case per workspace root
cases/<caseId>.json   # one case, including evidence excerpts
```

Excerpts are capped at 900 characters, tool-origin entries at 300 per case, and
manual findings are never trimmed. Reports and specs are written into the
workspace when exported.

## Permissions, and why each one exists

| Permission | Used for |
| --- | --- |
| `ui.file-explorer.context-menu` | "Investigate with REA" |
| `agent.mcp.control` | The bundled REA MCP server |
| `agent.tools.register` / `agent.toolHandler.execute` | The three case tools |
| `agent.hooks.register` / `agent.hookHandler.execute` | Automatic evidence capture |
| `agent.skills.control` | The bundled investigation skill |
| `agent.command.run` | Local probes only: `node`, `npm`, `java`, `rea` |
| `agent.session.write` | Right-click a target → start the investigation in the conversation |
| `storage.read` / `storage.write` | Cases |
| `fs.read` | Engine detection |

No network permission: the plugin never uploads anything. REA's server is the
only process that talks to the outside world, and the agent decides that.

## Design constraints worth keeping

- **No UI surface at all.** The conversation is the interface: the user talks to
  REA directly, and the plugin contributes tools, hooks, a skill and one file-tree
  action. A workspace view or a readiness panel would duplicate the agent's own
  job (it inspects the target and installs what a route needs) and cost the user a
  sidebar slot. There is therefore no React, no stylesheet and no `styles` entry.
- **Hooks are optional.** `registerHook` is wrapped; a host without the hook
  runtime keeps the four tools, and only loses auto-capture.
- **Evidence capture never breaks a turn.** Both hook handlers swallow their own
  failures and log them.
- **The grade is not decoration.** Tool output is `confirmed` as an observation;
  the agent's reading of it is `inferred`; a failed probe is `unknown`. Reports
  keep the three sections apart.
- **No engine claims.** `case_open` separates *absent* from *present but
  unverifiable* (the host gates `command.run` per plugin) and from *below the
  recommended version*, and the route table is data, not prose.
- **Installing is the agent's job.** `case_open` checks what the chosen route
  needs and names what is missing; the plugin never hands the user a manual
  install path or a readiness checklist.
- **Context ownership is per activation.** The host activates a reloaded plugin
  before running the previous cleanup; `clearPluginContext(token)` only releases
  the handle the caller still owns, so a late cleanup cannot tear down the live
  instance (that failure made every read report "not active" and every installed
  engine "missing").

## Development

```bash
cd abilities/plugins/rea
npm install
npm run check      # tsc --noEmit
npm run test       # vitest (pure domain tests)
npm run build      # vite build + local .vettapkg
npm run validate   # manifest validation
```

`dist/` and `release/` are not committed; CI builds the published package.

## Upstream and licensing

REA is maintained at [morluto/rea](https://github.com/morluto/rea) and published on
npm as `rea-agents`. This plugin does not vendor or repackage REA: the MCP server is
started with `npx -y rea-agents@latest mcp`, so upstream fixes arrive with the
upstream release. The marketplace icon is derived from the user-provided REA
artwork; REA's own licence and disclaimer apply to the tool.
