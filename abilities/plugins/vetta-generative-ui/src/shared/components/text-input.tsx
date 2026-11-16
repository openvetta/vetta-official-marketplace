import { cn, Input } from "@vetta-org/ui";
import { fieldClass } from "../styles/control-classes";

interface TextInputProps {
    id: string;
    type: "text" | "number" | "email" | "url" | "date" | "time";
    value: string | number;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
    onChange(value: string | number): void;
}

export function TextInput({ id, type, value, placeholder, min, max, step, disabled, invalid, describedBy, onChange }: TextInputProps) {
    return (
        <Input
            id={id}
            type={type}
            value={value}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(fieldClass)}
            onChange={(event) => {
                const raw = event.target.value;
                onChange(type === "number" && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw);
            }}
        />
    );
}
