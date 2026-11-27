# Vetta Reply HUD

Adds one line under the latest reply in a Vetta conversation: how fast the model wrote it, and which sources the turn used. Clicking a site icon opens that page in the default browser; the details dialog holds latency, a speed trend, token usage and a copyable source list.

## Requirements

- Vetta 0.6.32 or newer (Plugin API `^2.12.0`).
- Permissions: `ui.slot.turn-card`, `agent.session.read`, `shell.openExternal`, `network.fetch` (declared for every host, because sources can be any site).

## Speed

All figures come from the host's generation metrics (`useGenerationMetrics`); the plugin does not time events itself.

- **Live speed**: output tokens of the last 2 seconds; drops to 0 when the model pauses. Always an estimate.
- **Call / turn average**: output tokens ÷ time since the first token. The turn average excludes tool execution.
- **Estimates**: while streaming, output tokens are estimated from received characters and replaced with the provider's usage when the call ends. Values marked `≈` are estimates.
- Team conversations report `supported: false`; the speed line stays hidden.

## Sources

- **Cited links** come from the latest turn's assistant text: Markdown links keep their label, bare URLs are picked up too, fenced and inline code is ignored.
- **Opened pages** come from `tool-call-start` arguments (`url`, `urls`, `href`, `link`, `links`). The host only streams live events, so the list starts when the plugin activates; it is cleared when the user sends the next message and pages whose tool call failed are removed.
- Not available: search-result lists (those calls carry no URL), and history from before the plugin was loaded.
- **Icons** are resolved through `ctx.network.request`: the plugin reads the site's page, takes up to three declared `<link rel="icon">` / `apple-touch-icon` targets, then `/favicon.ico`, and inlines the first real image as a data URL (one hour cache, five minute negative cache). Nothing is sent to a third-party icon service.

## Development

```bash
npm install
npm run check && npm test && npm run build
npx vetta-plugin-cli add release/generation-speed-0.2.0.vettapkg
```

The speed trend is kept in memory while the card is mounted; it is not persisted.
