import { z } from "zod";

/**
 * The component vocabulary the Agent composes from. This file is the single source of truth:
 * the same zod schemas validate tool input at runtime and are converted to the JSON Schema
 * the model sees, so the documented contract and the enforced one cannot drift apart.
 */

export const TONES = ["neutral", "info", "success", "warning", "danger"] as const;
export const FIELD_KINDS = [
    "text",
    "textarea",
    "number",
    "email",
    "url",
    "date",
    "time",
    "select",
    "multiselect",
    "radio",
    "checkbox",
    "switch",
    "slider",
] as const;
export const CHOICE_KINDS = ["select", "multiselect", "radio"] as const;
export const CHART_TYPES = ["bar", "line", "pie", "doughnut", "radar", "polarArea", "scatter", "bubble"] as const;

const tone = z.enum(TONES).describe("Colour intent. Defaults to neutral.");
const label = (description: string) => z.string().min(1).max(200).describe(description);

const optionSchema = z.strictObject({
    label: label("Text shown to the user."),
    value: z.string().min(1).max(200).describe("Value submitted back. Keep it stable and short."),
});

export const fieldSchema = z
    .strictObject({
        name: z
            .string()
            .regex(/^[A-Za-z][\w-]{0,63}$/u)
            .describe("Key of this field in the submitted values, e.g. \"destination\". Unique within the form."),
        label: label("Field label shown above the control."),
        kind: z
            .enum(FIELD_KINDS)
            .describe(
                "Control type. select/radio = pick one option; multiselect = pick many; checkbox/switch = yes/no; slider = number in min..max.",
            ),
        placeholder: z.string().max(200).optional(),
        description: z.string().max(400).optional().describe("Help text under the control."),
        required: z.boolean().optional(),
        defaultValue: z
            .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
            .optional()
            .describe("Initial value. string[] for multiselect, boolean for checkbox/switch, number for number/slider."),
        span: z.literal("full").optional().describe("In a multi-column form, make this field take the whole row. Textarea, multiselect and radio already do."),
        options: z.array(optionSchema).min(1).max(50).optional().describe("Required for select, multiselect and radio."),
        min: z.number().optional().describe("number/slider lower bound."),
        max: z.number().optional().describe("number/slider upper bound."),
        step: z.number().positive().optional().describe("number/slider step."),
    })
    .superRefine((field, issue) => {
        if ((CHOICE_KINDS as readonly string[]).includes(field.kind) && !field.options?.length) {
            issue.addIssue({ code: "custom", path: ["options"], message: `options are required for kind "${field.kind}"` });
        }
    });

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const headingBlock = z.strictObject({
    type: z.literal("heading"),
    text: label("Heading text."),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe("1 = largest. Defaults to 2."),
});

const textBlock = z.strictObject({
    type: z.literal("text"),
    text: z.string().min(1).max(4000).describe("Plain paragraph text. Line breaks are kept. No Markdown."),
    muted: z.boolean().optional().describe("Secondary, smaller text."),
});

const badgesBlock = z.strictObject({
    type: z.literal("badges"),
    items: z.array(z.strictObject({ label: label("Badge text."), tone: tone.optional() })).min(1).max(20),
});

const alertBlock = z.strictObject({
    type: z.literal("alert"),
    tone: tone.optional(),
    title: z.string().max(200).optional(),
    text: z.string().min(1).max(2000),
});

const statsBlock = z.strictObject({
    type: z.literal("stats"),
    items: z
        .array(
            z.strictObject({
                label: label("Metric name."),
                value: z.union([z.string(), z.number()]).describe("Main figure, already formatted, e.g. \"$12.4k\"."),
                delta: z.string().max(40).optional().describe("Change, e.g. \"+8.2%\"."),
                trend: z.enum(["up", "down", "flat"]).optional().describe("Colours the delta: up = green, down = red."),
                hint: z.string().max(120).optional(),
            }),
        )
        .min(1)
        .max(8)
        .describe("KPI tiles shown in a row."),
});

const keyValueBlock = z.strictObject({
    type: z.literal("keyValue"),
    items: z.array(z.strictObject({ label: label("Property name."), value: z.union([z.string(), z.number()]) })).min(1).max(40),
});

const tableBlock = z.strictObject({
    type: z.literal("table"),
    caption: z.string().max(200).optional(),
    columns: z
        .array(
            z.strictObject({
                key: z.string().min(1).max(64).describe("Property read from each row."),
                label: label("Column header."),
                align: z.enum(["left", "right", "center"]).optional().describe("Use right for numbers."),
            }),
        )
        .min(1)
        .max(12),
    rows: z.array(z.record(z.string(), cell)).max(200).describe("Objects keyed by column key."),
});

const listBlock = z.strictObject({
    type: z.literal("list"),
    ordered: z.boolean().optional(),
    items: z
        .array(
            z.strictObject({
                title: label("Item title."),
                description: z.string().max(400).optional(),
                meta: z.string().max(80).optional().describe("Short trailing text, e.g. a date or amount."),
            }),
        )
        .min(1)
        .max(50),
});

const progressBlock = z.strictObject({
    type: z.literal("progress"),
    label: z.string().max(200).optional(),
    value: z.number(),
    max: z.number().positive().optional().describe("Defaults to 100."),
    tone: tone.optional(),
});

const imageBlock = z.strictObject({
    type: z.literal("image"),
    src: z
        .string()
        .regex(/^(?:https:\/\/|data:image\/)/u, "src must be an https:// URL or a data:image/ URI")
        .describe("https:// URL or data:image/ URI."),
    alt: label("Alternative text."),
    caption: z.string().max(200).optional(),
});

const chartBlock = z.strictObject({
    type: z.literal("chart"),
    chartType: z.enum(CHART_TYPES),
    title: z.string().max(200).optional(),
    data: z
        .looseObject({
            labels: z.array(z.union([z.string(), z.number()])).optional(),
            datasets: z.array(z.looseObject({ label: z.string().optional(), data: z.array(z.unknown()) })).min(1).max(12),
        })
        .describe("Standard Chart.js data object. Colours are optional: the theme palette is applied when omitted."),
    options: z.record(z.string(), z.unknown()).optional().describe("Optional standard Chart.js options."),
    height: z.number().min(160).max(560).optional().describe("Pixels. Defaults to 280."),
});

const dividerBlock = z.strictObject({ type: z.literal("divider") });

const actionsBlock = z.strictObject({
    type: z.literal("actions"),
    buttons: z
        .array(
            z.strictObject({
                label: label("Button text."),
                prompt: z.string().min(1).max(2000).describe("Sent as the user's next message when clicked."),
                variant: z.enum(["primary", "secondary"]).optional(),
            }),
        )
        .min(1)
        .max(6)
        .describe("Quick replies. The first click is sent and the group locks."),
});

const formBlock = z
    .strictObject({
        type: z.literal("form"),
        title: z.string().max(200).optional(),
        description: z.string().max(600).optional(),
        columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe("Lay fields out in 1-3 columns (they stack on narrow widths). Defaults to 1; use 2 for forms with more than ~4 short fields."),
        fields: z.array(fieldSchema).min(1).max(30),
        submitLabel: z.string().max(40).optional().describe("Defaults to \"Submit\"."),
    })
    .superRefine((form, issue) => {
        const names = new Set<string>();
        form.fields.forEach((field, index) => {
            if (names.has(field.name)) issue.addIssue({ code: "custom", path: ["fields", index, "name"], message: `duplicate field name "${field.name}"` });
            names.add(field.name);
        });
    });

export const leafBlockSchema = z.discriminatedUnion("type", [
    headingBlock,
    textBlock,
    badgesBlock,
    alertBlock,
    statsBlock,
    keyValueBlock,
    tableBlock,
    listBlock,
    progressBlock,
    imageBlock,
    chartBlock,
    dividerBlock,
    actionsBlock,
    formBlock,
]);

/**
 * Containers nest up to three levels (e.g. tabs > columns > card > content). The levels are built
 * explicitly rather than with z.lazy so the inferred types stay concrete and the depth is bounded.
 */
/** Models sometimes write a column as a bare block instead of `{ blocks: [...] }`; wrap it rather than fail the view. */
function wrapBareColumn(value: unknown): unknown {
    if (value && typeof value === "object" && !Array.isArray(value) && "type" in value && !("blocks" in value)) return { blocks: [value] };
    return value;
}

function containers<T extends z.ZodType>(child: T) {
    const blocks = z.array(child).min(1).max(20);
    const card = z.strictObject({
        type: z.literal("card"),
        title: z.string().max(200).optional(),
        description: z.string().max(600).optional(),
        blocks: blocks.describe("Content of the card."),
    });
    const columns = z.strictObject({
        type: z.literal("columns"),
        weights: z
            .array(z.number().min(1).max(6))
            .min(2)
            .max(4)
            .optional()
            .describe("Relative column widths, one per column, e.g. [2,1] for a wide main column and a narrow side column. Equal widths when omitted."),
        columns: z.array(z.preprocess(wrapBareColumn, z.strictObject({ blocks }))).min(2).max(4).describe("Side-by-side columns; they stack on narrow widths."),
    });
    const tabs = z.strictObject({
        type: z.literal("tabs"),
        tabs: z.array(z.strictObject({ label: label("Tab label."), blocks })).min(2).max(6),
    });
    return [card, columns, tabs] as const;
}

const level1Schema = z.discriminatedUnion("type", [...leafBlockSchema.options, ...containers(leafBlockSchema)]);
const level2Schema = z.discriminatedUnion("type", [...leafBlockSchema.options, ...containers(level1Schema)]);

export const blockSchema = z.discriminatedUnion("type", [...leafBlockSchema.options, ...containers(level2Schema)]);

// Top level tolerates unknown keys (stripped): models copy host tool habits such as `md_intro`,
// and rejecting the whole view over a harmless extra key leaves the user with an error card.
export const uiDocumentSchema = z.object({
    title: z.string().max(200).optional().describe("Title of the whole view."),
    description: z.string().max(600).optional(),
    width: z.enum(["normal", "wide"]).optional().describe("\"wide\" gives dashboards and multi-column layouts more room. Defaults to normal."),
    blocks: z.array(blockSchema).min(1).max(40).describe("Rendered top to bottom."),
});

export type UiDocument = z.infer<typeof uiDocumentSchema>;
export type Block = z.infer<typeof blockSchema>;
export type LeafBlock = z.infer<typeof leafBlockSchema>;
export type FormBlock = z.infer<typeof formBlock>;
export type ActionsBlock = z.infer<typeof actionsBlock>;
export type ChartBlock = z.infer<typeof chartBlock>;
export type FieldSpec = z.infer<typeof fieldSchema>;
export type Tone = (typeof TONES)[number];

export const htmlDocumentSchema = z.object({
    title: z.string().max(200).optional().describe("Shown above the view."),
    html: z
        .string()
        .min(1)
        .max(200_000)
        .describe("A complete HTML document or a body fragment. Inline <style> and <script> are allowed."),
    libs: z
        .array(z.enum(["tailwind", "chartjs"]))
        .max(2)
        .optional()
        .describe("Optional built-in libraries, injected offline: \"tailwind\" (Tailwind CSS v4 utilities, themed to Vetta) and \"chartjs\" (global Chart). Only request what the page uses."),
    height: z
        .number()
        .min(120)
        .max(1600)
        .optional()
        .describe("Fixed height in pixels. Omit to size to the content automatically."),
});

export type HtmlDocument = z.infer<typeof htmlDocumentSchema>;

/** JSON Schema handed to the model. Inline (no $ref) so every provider can read it. */
export function toToolParameters(schema: z.ZodType): Record<string, unknown> {
    const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { unrepresentable: "any", io: "input" }) as Record<string, unknown>;
    return json;
}

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json => !!value && typeof value === "object" && !Array.isArray(value);

/** `oneOf` → `anyOf`: equivalent for a discriminated union and accepted by more providers. */
function preferAnyOf(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(preferAnyOf);
    if (!isJson(node)) return node;
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key === "oneOf" ? "anyOf" : key, preferAnyOf(value)]));
}

const NESTED_ITEMS = {
    type: "object",
    description: "Any block type listed above, including card, columns and tabs (containers nest up to 3 levels deep). Same fields as at the top level.",
    properties: { type: { type: "string" } },
    required: ["type"],
};

/** Drops `additionalProperties: false` everywhere: the host rejects a call before our handler runs, and a harmless extra key should not cost the user a failed view. Runtime validation stays strict about the fields that matter. */
function relax(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(relax);
    if (!isJson(node)) return node;
    return Object.fromEntries(Object.entries(node).filter(([key, value]) => !(key === "additionalProperties" && value === false)).map(([key, value]) => [key, relax(value)]));
}

/**
 * JSON Schema for render_ui. Container blocks repeat the full content vocabulary, which would
 * quadruple the schema; the model-facing copy points back to it instead. Runtime validation
 * still uses the strict zod schema and returns exact paths when a nested block is wrong.
 */
export function uiToolParameters(): Json {
    const json = relax(preferAnyOf(toToolParameters(uiDocumentSchema))) as Json;
    const variants = ((json.properties as Json).blocks as Json).items as Json;
    for (const variant of (variants.anyOf as Json[]) ?? []) {
        const props = variant.properties as Json;
        const kind = (props.type as Json).const;
        if (kind === "card") (props.blocks as Json).items = NESTED_ITEMS;
        if (kind === "tabs") ((((props.tabs as Json).items as Json).properties as Json).blocks as Json).items = NESTED_ITEMS;
        if (kind === "columns") {
            props.columns = {
                type: "array",
                minItems: 2,
                maxItems: 4,
                description: "Side-by-side columns; they stack on narrow widths. Each column is an object { blocks: [...] }.",
                items: { type: "object", properties: { blocks: { type: "array", minItems: 1, maxItems: 20, items: NESTED_ITEMS } } },
            };
        }
    }
    return json;
}

/** Model-readable validation errors, capped so a broken call does not flood the context. */
export function describeIssues(error: z.ZodError): string[] {
    return error.issues.slice(0, 8).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}
