import { useTranslation } from "@vetta-org/plugin-sdk";
import type { FieldValue } from "../../../domain/form-values";
import type { FieldSpec } from "../../../domain/ui-schema";
import { CheckboxInput } from "../../../shared/components/checkbox-input";
import { ChoiceChips } from "../../../shared/components/choice-chips";
import { FieldLabel } from "../../../shared/components/field-label";
import { RadioGroup } from "../../../shared/components/radio-group";
import { SelectInput } from "../../../shared/components/select-input";
import { SliderInput } from "../../../shared/components/slider-input";
import { SwitchInput } from "../../../shared/components/switch-input";
import { TextArea } from "../../../shared/components/text-area";
import { TextInput } from "../../../shared/components/text-input";

interface FormFieldProps {
    idPrefix: string;
    field: FieldSpec;
    value: FieldValue;
    error?: "required" | "range";
    disabled: boolean;
    onChange(value: FieldValue): void;
}

export function FormField({ idPrefix, field, value, error, disabled, onChange }: FormFieldProps) {
    const { t } = useTranslation();
    const id = `${idPrefix}-${field.name}`;
    const hintId = field.description || error ? `${id}-hint` : undefined;
    const options = field.options ?? [];
    const inline = field.kind === "checkbox" || field.kind === "switch";

    const control = (() => {
        switch (field.kind) {
            case "textarea":
                return <TextArea id={id} value={String(value)} placeholder={field.placeholder} disabled={disabled} invalid={!!error} describedBy={hintId} onChange={onChange} />;
            case "select":
                return (
                    <SelectInput
                        id={id}
                        value={String(value)}
                        options={options}
                        placeholder={field.placeholder ?? t("form.selectPlaceholder")}
                        disabled={disabled}
                        invalid={!!error}
                        describedBy={hintId}
                        onChange={onChange}
                    />
                );
            case "multiselect":
                return <ChoiceChips id={id} label={field.label} value={Array.isArray(value) ? value : []} options={options} disabled={disabled} onChange={onChange} />;
            case "radio":
                return <RadioGroup id={id} label={field.label} value={String(value)} options={options} disabled={disabled} onChange={onChange} />;
            case "checkbox":
                return <CheckboxInput id={id} label={field.label} checked={value === true} disabled={disabled} onChange={onChange} />;
            case "switch":
                return <SwitchInput id={id} label={field.label} checked={value === true} disabled={disabled} onChange={onChange} />;
            case "slider":
                return (
                    <SliderInput
                        id={id}
                        value={typeof value === "number" ? value : Number(value) || 0}
                        min={field.min ?? 0}
                        max={field.max ?? 100}
                        step={field.step ?? 1}
                        disabled={disabled}
                        describedBy={hintId}
                        onChange={onChange}
                    />
                );
            default:
                return (
                    <TextInput
                        id={id}
                        type={field.kind}
                        value={typeof value === "number" ? value : String(value)}
                        placeholder={field.placeholder}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        disabled={disabled}
                        invalid={!!error}
                        describedBy={hintId}
                        onChange={onChange}
                    />
                );
        }
    })();

    const wide = field.span === "full" || ["textarea", "multiselect", "radio"].includes(field.kind);
    return (
        <div className={wide ? "col-span-full" : undefined}>
            {inline ? null : (
                <FieldLabel htmlFor={field.kind === "multiselect" || field.kind === "radio" ? undefined : id} required={field.required}>
                    {field.label}
                </FieldLabel>
            )}
            {control}
            {hintId ? (
                <p id={hintId} className={`mt-1.5 text-xs ${error ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                    {error ? t(error === "required" ? "form.required" : "form.range") : field.description}
                </p>
            ) : null}
        </div>
    );
}
