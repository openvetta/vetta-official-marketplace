# Web Access

Search the public web and read pages or PDFs from a conversation. The default search is free and
keyless; every provider below is optional.

## What the agent gets

| Tool | Purpose | Notes |
| --- | --- | --- |
| `web_search` | Titles, URLs and snippets for a query | Optional `provider` override and `objective` hint |
| `web_fetch` | One URL as clean Markdown or plain text | Character budget, `markdown` / `text` |

Both tools are available in `conversation`, `project`, `im-claw`, `automation`, `kb-processing`,
`batch` and `cli` scopes.

## Providers

| Provider | Setting | Requirement | Endpoint |
| --- | --- | --- | --- |
| Exa (free) | `exa-mcp` | none | `https://mcp.exa.ai/mcp` (MCP over streamable HTTP) |
| Exa | `exa` | `exaApiKey` | `https://api.exa.ai/search` |
| Brave Search | `brave` | `braveApiKey` | `https://api.search.brave.com/res/v1/web/search` |
| Tavily | `tavily` | `tavilyApiKey` | `https://api.tavily.com/search` |
| Bocha | `bocha` | `bochaApiKey` | `https://api.bochaai.com/v1/web-search` |
| SearXNG | `searxng` | instance URL with JSON API | `<base>/search?format=json` |

`searchProvider: "auto"` (the default) tries a configured SearXNG instance first, then Exa, Tavily,
Brave and Bocha when their keys exist, and ends at the free Exa endpoint. A provider that answers
with an empty list is treated as "not answered" and the chain continues.

Reading a page (`fetchMode`):

1. `direct` — fetch the URL from this machine, extract with Readability, convert to Markdown.
2. `exa` — Exa's hosted reader (free, no key). Used when the page is a PDF, blocks bots, or returns
   too little text.
3. `jina` — `https://r.jina.ai/<url>`, with `jinaApiKey` sent as a bearer token when configured.

`fetchMode: "auto"` runs 1, then 2, then 3 if `remoteFallback` is on. Setting `remoteFallback` off
keeps every URL on the machine and will fail loudly on bot-walled pages instead of sending the URL out.

## Where configuration lives

- Non-secret settings: `settings.json` in this plugin's private storage
  (`~/.vetta/plugin-data/web-access/settings.json`).
- Keys: the host's encrypted credential store via `ctx.secrets`
  (`exaApiKey`, `braveApiKey`, `tavilyApiKey`, `bochaApiKey`, `jinaApiKey`). They are never written to
  `settings.json` and never echoed back into the UI.

The settings page is a workspace view with `sidebar: false`, so it lives under
**Settings → More options → Web Access**. The ability detail page carries a runtime card
(`features/setup`) with the current provider, reader, key state, a live test query and a link into
that page; the surrounding story in `detail.json` / `detail.zh.json` ships with the marketplace
distribution (a local `vetta-plugin-cli add` install only loads the packaged runtime card).

The detail page is text and layout blocks only. It carries no screenshots on purpose: the runtime
card above is the live half of that page, and a static picture of the settings screen would be stale
the first time the layout changes.

## Safety boundaries

- `network.allowedHosts` is `["*"]`: the plugin's whole purpose is reaching URLs the user names or
  the agent finds, and a fixed host list cannot cover search results or a user-supplied SearXNG
  instance.
- Loopback and private ranges (`localhost`, `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`,
  link-local, `.local`, `.internal`, …) are refused unless **Allow reading local and private
  addresses** is enabled.
- Only `http:` and `https:` URLs are accepted.
- Redirects are followed by the host's network layer, which drops `authorization` and `cookie`
  headers on cross-origin hops.
- JSON bodies from providers are parsed with `zod`; an unexpected shape yields "no results" instead of
  an exception inside the tool.

## Development

```bash
npm install
npx vetta-plugin-cli docs      # SDK handbook for the exact installed version
npx tsc --noEmit
npx vitest run
npx vite build
```

`dist/` and `release/` are build output and are not tracked. See the repository root `AGENTS.md`
for the marketplace version and publishing rules.

## Troubleshooting

- **Brave/Tavily/Exa key rejected (HTTP 401/403)** — the provider names the reason in the tool error;
  the same query still works by switching the provider to Automatic.
- **SearXNG returns HTML instead of JSON** — enable `json` in the instance's `search.formats`; the
  plugin reports this explicitly.
- **A page reads as almost empty** — it is JavaScript-rendered or bot-walled. `auto` mode falls back
  to the hosted reader; `direct` mode reports it instead of guessing.
- **PDF is garbled** — PDFs are not parsed locally. Leave the hosted reader on, or use `jina`.
