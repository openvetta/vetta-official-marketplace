import { textareaClass } from "../styles/control-classes";

interface TextAreaProps {
    id: string;
    value: string;
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
    onChange(value: string): void;
}

export function TextArea({ id, value, placeholder, disabled, invalid, describedBy, onChange }: TextAreaProps) {
    return (
        <textarea
            id={id}
            value={value}
            rows={3}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={`${textareaClass} border-0`}
            onChange={(event) => onChange(event.target.value)}
        />
    );
}
