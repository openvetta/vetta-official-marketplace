# Generation Speed

Shows the model's generation speed under the latest reply in a Vetta conversation and opens a details dialog on click.

## Requirements

- Vetta 0.6.32 or newer (Plugin API `^2.12.0`).
- Permissions: `ui.slot.turn-card`, `agent.session.metrics` (speed and usage only, no message content).

## How the numbers are computed

All figures come from the host's generation metrics (`useGenerationMetrics`); the plugin does not time events itself.

- **Live speed**: output tokens of the last 2 seconds; drops to 0 when the model pauses. Always an estimate.
- **Call / turn average**: output tokens ÷ time since the first token. The turn average excludes tool execution.
- **Estimates**: while streaming, output tokens are estimated from received characters and replaced with the provider's usage when the call ends. Values marked `≈` are estimates.
- Team conversations report `supported: false`; the line stays hidden.

## Development

```bash
npm install
npm run check && npm test && npm run build
npx vetta-plugin-cli add release/generation-speed-0.1.0.vettapkg
```

The speed trend is kept in memory while the card is mounted; it is not persisted.
