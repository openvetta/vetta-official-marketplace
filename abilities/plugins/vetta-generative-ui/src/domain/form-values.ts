import type { FieldSpec, FormBlock } from "./ui-schema";

export type FieldValue = string | number | boolean | string[];
export type FormValues = Record<string, FieldValue>;

export function initialValue(field: FieldSpec): FieldValue {
    const fallback = field.defaultValue;
    switch (field.kind) {
        case "checkbox":
        case "switch":
            return typeof fallback === "boolean" ? fallback : false;
        case "multiselect":
            return Array.isArray(fallback) ? fallback : [];
        case "slider":
            return typeof fallback === "number" ? fallback : (field.min ?? 0);
        case "number":
            return typeof fallback === "number" ? fallback : "";
        default:
            return fallback === undefined || Array.isArray(fallback) ? "" : String(fallback);
    }
}

export function initialValues(form: FormBlock): FormValues {
    return Object.fromEntries(form.fields.map((field) => [field.name, initialValue(field)]));
}

function isEmpty(value: FieldValue | undefined): boolean {
    return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

/** Field name → error key. Only `required` and numeric bounds are enforced; the Agent re-checks semantics. */
export function validateForm(form: FormBlock, values: FormValues): Record<string, "required" | "range"> {
    const errors: Record<string, "required" | "range"> = {};
    for (const field of form.fields) {
        const value = values[field.name];
        if (field.required && (isEmpty(value) || ((field.kind === "checkbox" || field.kind === "switch") && value !== true))) {
            errors[field.name] = "required";
            continue;
        }
        if (field.kind === "number" && typeof value === "number") {
            if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) errors[field.name] = "range";
        }
    }
    return errors;
}

function displayValue(field: FieldSpec, value: FieldValue | undefined): string {
    if (isEmpty(value)) return "—";
    const optionLabel = (raw: string) => field.options?.find((option) => option.value === raw)?.label ?? raw;
    if (Array.isArray(value)) return value.map(optionLabel).join(", ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return field.options ? optionLabel(String(value)) : String(value);
}

/**
 * The message sent back to the Agent: a readable list for the transcript plus exact
 * machine values, so the model never has to parse labels back into option values.
 */
export function formatSubmission(form: FormBlock, values: FormValues): string {
    const heading = form.title ? `Submitted form "${form.title}":` : "Submitted form:";
    const lines = form.fields.map((field) => `- ${field.label}: ${displayValue(field, values[field.name])}`);
    const exact = Object.fromEntries(form.fields.map((field) => [field.name, values[field.name] ?? null]));
    return [heading, ...lines, "", "```json", JSON.stringify(exact, null, 2), "```"].join("\n");
}

export function describeValue(field: FieldSpec, value: FieldValue | undefined): string {
    return displayValue(field, value);
}
