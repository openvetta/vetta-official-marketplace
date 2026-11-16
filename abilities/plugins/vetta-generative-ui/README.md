# Vetta Generative UI

Lets the Agent answer with interactive views rendered inline in the conversation.

## Agent tools

| Tool | Purpose |
| --- | --- |
| `render_ui` | Declarative view built from the plugin's component library. Validated with zod; the same schema is converted to the JSON Schema the model sees (`src/domain/ui-schema.ts`). |
| `render_html` | Model-written HTML in a sandboxed iframe. |

Both are scoped to `conversation` and `project`. Each tool call row is replaced by the view through `registerToolCallSlot`; controls are disabled until the call succeeds.

### When the Agent is nudged to use a view

A static system-prompt block (`src/prompt/visual-answer-guidance.ts`, permission `agent.systemPrompt.write`) is added in `conversation` and `project` chats. It lists the visual cases (comparisons, numbers and trends, plans and timelines, multi-input collection, things to play with) and the cases that should stay plain text, and prefers `render_ui` over `render_html`. Edit that file to tune how eagerly views are used.

### `render_ui` components

- Content: `heading`, `text`, `badges`, `alert`, `divider`, `stats`, `keyValue`, `table`, `list`, `progress`, `image`, `chart` (Chart.js)
- Interactive: `form` (`text`, `textarea`, `number`, `email`, `url`, `date`, `time`, `select`, `multiselect`, `radio`, `checkbox`, `switch`, `slider`), `actions` (quick replies)
- Layout: `card`, `columns` (optional `weights`, e.g. `[2,1]`), `tabs`; containers nest up to 3 levels. `form.columns` (1-3) and `field.span: "full"` control form layout; document `width: "wide"` gives dense views more room

Form submission and quick replies call `conversation.sendPrompt`, so they arrive as the user's next message. A form submission includes the exact values as JSON. Completed interactions are stored per tool call in plugin storage (`interactions/<toolCallId>.json`), so a reopened conversation shows the form as submitted.

The model-facing schema describes nested container blocks by reference to keep it small (~12 KB); runtime validation is strict and returns exact issue paths to the model.

### `render_html` sandbox

- `sandbox="allow-scripts"` without `allow-same-origin`: opaque origin, no access to host DOM, storage, cookies or plugin APIs; no popups, navigation or forms.
- Injected CSP: `connect-src 'none'`, `form-action 'none'`; scripts, styles, fonts and images may load inline or over https.
- An injected stylesheet exposes the host theme as `--vg-*` variables and `vg-*` helper classes. Theme switches are pushed in via `postMessage` without reloading the view.
- `window.vetta.sendPrompt(text)` posts to the host. The host accepts messages only from that iframe's window and asks the user to confirm before sending.
- Height follows content (120–1600 px) unless `height` is set. Partial HTML is not mounted while the call is streaming.

## Development

```bash
npm install
npm run check
npm run test
npm run build
npx vetta-plugin-cli watch
```
