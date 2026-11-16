import type { PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import { describeIssues, type HtmlDocument, htmlDocumentSchema, toToolParameters } from "../domain/ui-schema";
import { GENERATIVE_UI_SCOPES, RENDER_HTML_TOOL } from "./tool-scopes";

const DESCRIPTION = `Render model-written HTML as a live, interactive view in the conversation, inside an isolated sandbox.

Use it when the view needs custom layout, animation, a small interactive tool (calculator, simulator, game, diagram) or a visual that render_ui components cannot express. Prefer render_ui for ordinary forms, tables, KPIs and charts: it is faster and always matches the app.

Environment:
- Inline <style> and <script> run. External scripts, styles, fonts and images load over https (e.g. a CDN). fetch/XHR/WebSocket and form submission are blocked; keep data inline.
- Vetta styling is built in. Plain HTML elements already look right and follow light/dark: input, textarea, select (upgraded to a styled menu), date/time, checkbox, radio, range, button, table, details, progress, code. Write semantic markup and do not restyle these; your own CSS still overrides. Do not use borders to separate things: Vetta uses soft fills and whitespace.
- Helpers: CSS variables --vg-bg, --vg-fg, --vg-muted, --vg-border, --vg-primary, --vg-primary-fg, --vg-radius, --vg-font; classes vg-card, vg-stat (+ vg-stat-label, vg-stat-value), vg-grid, vg-row, vg-stack, vg-label, vg-input, vg-btn, vg-btn-primary, vg-chip (aria-pressed), vg-badge, vg-muted. Tabs: a container with role="tablist" holding role="tab" buttons (aria-selected). Switch: <input type="checkbox" role="switch">. A submit button is primary. window.vetta.palette is an array of chart colours.
- Optional "libs" (injected offline, prefer them over CDN links): "tailwind" gives Tailwind CSS v4 utilities themed to Vetta (bg-card, bg-primary, text-primary-foreground, text-muted-foreground, bg-muted, rounded-xl...); "chartjs" gives a global Chart (colours and fonts already themed). Request only what the page uses.
- Height follows the content automatically unless "height" is set.
- To send something back, call window.vetta.sendPrompt(text) from a user action. The user confirms it before it is sent, and it arrives as their next message.`;

export function createRenderHtmlTool(): PluginAgentToolRegistration<HtmlDocument> {
    return {
        id: "render-html",
        name: RENDER_HTML_TOOL,
        label: "%tool.renderHtml.label%",
        description: DESCRIPTION,
        parameters: toToolParameters(htmlDocumentSchema),
        scope_use: GENERATIVE_UI_SCOPES,
        timeoutMs: 10_000,
        handler: async ({ trigger: { input } }) => {
            const parsed = htmlDocumentSchema.safeParse(input);
            if (!parsed.success) {
                return { ok: false, retryable: true, error: "Invalid HTML view.", issues: describeIssues(parsed.error) };
            }
            return { ok: true, rendered: true, characters: parsed.data.html.length };
        },
    };
}
