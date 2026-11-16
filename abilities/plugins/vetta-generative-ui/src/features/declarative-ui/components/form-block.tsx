import { useTranslation } from "@vetta-org/plugin-sdk";
import { type FormEvent, useId, useState } from "react";
import { type FieldValue, type FormValues, formatSubmission, initialValues, validateForm } from "../../../domain/form-values";
import type { FormBlock as FormBlockSpec } from "../../../domain/ui-schema";
import { Button } from "@vetta-org/ui";
import { sectionClass } from "../../../shared/styles/control-classes";
import type { ViewEnv } from "../view-env";
import { FormField } from "./form-field";

const FORM_COLUMNS = { 1: "", 2: "@xl:grid-cols-2", 3: "@xl:grid-cols-2 @3xl:grid-cols-3" } as const;

interface FormBlockProps {
    block: FormBlockSpec;
    path: string;
    env: ViewEnv;
}

export function FormBlock({ block, path, env }: FormBlockProps) {
    const { t } = useTranslation();
    const idPrefix = useId();
    const submitted = env.records[path];
    const [values, setValues] = useState<FormValues>(() => initialValues(block));
    const [errors, setErrors] = useState<ReturnType<typeof validateForm>>({});
    const [sending, setSending] = useState(false);
    const shown = (submitted?.values as FormValues | undefined) ?? values;
    const locked = !env.interactive || !!submitted || sending;

    const update = (name: string, value: FieldValue) => {
        setValues((current) => ({ ...current, [name]: value }));
        setErrors((current) => {
            const { [name]: _removed, ...rest } = current;
            return rest;
        });
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (locked) return;
        const found = validateForm(block, values);
        setErrors(found);
        if (Object.keys(found).length) return;
        setSending(true);
        try {
            const result = await env.deps.sendPrompt(formatSubmission(block, values));
            if (result.status === "failed") throw new Error(result.error?.message ?? "sendPrompt failed");
            await env.record(path, { kind: "form", at: Date.now(), values });
        } catch (error) {
            env.deps.notify({ message: t("error.send"), error });
        } finally {
            setSending(false);
        }
    };

    return (
        <form noValidate onSubmit={submit} aria-label={block.title ?? t("form.label")} className={`${sectionClass} @container`}>
            {block.title || block.description ? (
                <div className="mb-5">
                    {block.title ? <h4 className="text-sm font-semibold text-foreground">{block.title}</h4> : null}
                    {block.description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{block.description}</p> : null}
                </div>
            ) : null}
            <div className={`grid gap-x-4 gap-y-5 ${FORM_COLUMNS[block.columns ?? 1]}`}>
                {block.fields.map((field) => (
                    <FormField
                        key={field.name}
                        idPrefix={idPrefix}
                        field={field}
                        value={shown[field.name] ?? ""}
                        error={errors[field.name]}
                        disabled={locked}
                        onChange={(value) => update(field.name, value)}
                    />
                ))}
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
                {submitted ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-emerald-600 dark:text-emerald-400">
                        <span aria-hidden="true" className="icon-[solar--check-circle-linear] size-4" />
                        {t("form.submitted")}
                    </span>
                ) : null}
                {submitted ? null : (
                    <Button type="submit" variant="primary" disabled={locked}>
                        {sending ? <span aria-hidden="true" className="icon-[solar--refresh-linear] size-4 animate-spin" /> : null}
                        {block.submitLabel ?? t("form.submit")}
                    </Button>
                )}
            </div>
        </form>
    );
}
