import type { ReactNode } from "react";

interface FieldLabelProps {
    htmlFor?: string;
    required?: boolean;
    children: ReactNode;
}

export function FieldLabel({ htmlFor, required, children }: FieldLabelProps) {
    return (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-foreground">
            {children}
            {required ? <span className="ml-0.5 text-red-500" aria-hidden="true">*</span> : null}
        </label>
    );
}
