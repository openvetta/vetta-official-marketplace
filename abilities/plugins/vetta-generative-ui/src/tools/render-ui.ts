import type { PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import { type Block, describeIssues, type UiDocument, uiDocumentSchema, uiToolParameters } from "../domain/ui-schema";
import { GENERATIVE_UI_SCOPES, RENDER_UI_TOOL } from "./tool-scopes";

const DESCRIPTION = `Render an interactive view in the conversation, built from Vetta's component library. The view follows the app theme.

Use it when a structured view helps more than prose: forms that collect several inputs, choices the user should click, KPI summaries, tables, charts, comparisons, status overviews.

Compose "blocks" top to bottom. Components:
- heading, text, badges, alert, divider
- stats (KPI tiles), keyValue (property list), table, list, progress, image
- chart (Chart.js: bar/line/pie/doughnut/radar/polarArea/scatter/bubble; standard data object, colours optional)
- form (fields: text, textarea, number, email, url, date, time, select, multiselect, radio, checkbox, switch, slider)
- actions (quick-reply buttons; each button carries the prompt to send)
- layout: card (titled group), columns (2-4 side by side; optional \"weights\" such as [2,1] for relative widths), tabs (2-6). Containers nest up to 3 levels (e.g. tabs > columns > card), so you can build dashboards, side panels and master/detail layouts. Set the document's width to \"wide\" for dense layouts.
- form layout: \"columns\": 2 or 3 puts short fields side by side (use 2 once a form has more than ~4 fields); \"span\": \"full\" makes one field take the whole row.

Compose layouts deliberately rather than stacking everything in one column: group related content into cards, put KPIs in a stats row, put a chart next to its table with columns, and split long forms into columns or tabs.

Interaction: when the user submits a form or clicks an action, it arrives as their next user message (forms include exact values as JSON). After rendering a form or actions, end your turn and wait; do not guess the answer.

Do not use it for a short answer that reads fine as text, or to ask a single yes/no question. Use render_html instead only when the view needs custom layout, animation or behaviour these components cannot express.`;

function collectInteractive(blocks: readonly Block[], found: string[]): void {
    for (const block of blocks) {
        if (block.type === "form") found.push(`form${block.title ? ` "${block.title}"` : ""}`);
        else if (block.type === "actions") found.push(`${block.buttons.length} quick-reply button(s)`);
        else if (block.type === "card") collectInteractive(block.blocks, found);
        else if (block.type === "columns") for (const column of block.columns) collectInteractive(column.blocks, found);
        else if (block.type === "tabs") for (const tab of block.tabs) collectInteractive(tab.blocks, found);
    }
}

export function createRenderUiTool(): PluginAgentToolRegistration<UiDocument> {
    return {
        id: "render-ui",
        name: RENDER_UI_TOOL,
        label: "%tool.renderUi.label%",
        description: DESCRIPTION,
        parameters: uiToolParameters(),
        scope_use: GENERATIVE_UI_SCOPES,
        timeoutMs: 10_000,
        handler: async ({ trigger: { input } }) => {
            const parsed = uiDocumentSchema.safeParse(input);
            if (!parsed.success) {
                return { ok: false, retryable: true, error: "Invalid view. Fix these fields and call render_ui again.", issues: describeIssues(parsed.error) };
            }
            const interactive: string[] = [];
            collectInteractive(parsed.data.blocks, interactive);
            return {
                ok: true,
                rendered: true,
                blocks: parsed.data.blocks.length,
                ...(interactive.length
                    ? {
                          awaitingUser: interactive,
                          next: "The view is shown. The user's input will arrive as their next message; end this turn now.",
                      }
                    : {}),
            };
        },
    };
}
