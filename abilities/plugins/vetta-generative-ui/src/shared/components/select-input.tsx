import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@vetta-org/ui";
import { selectContentClass, selectItemClass, selectTriggerClass } from "../styles/control-classes";

interface SelectInputProps {
    id: string;
    value: string;
    options: ReadonlyArray<{ label: string; value: string }>;
    placeholder: string;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
    onChange(value: string): void;
}

/** The host's dropdown (Radix), restyled without an outline. */
export function SelectInput({ id, value, options, placeholder, disabled, invalid, describedBy, onChange }: SelectInputProps) {
    return (
        <Select value={value} disabled={disabled} onValueChange={onChange}>
            <SelectTrigger id={id} className={selectTriggerClass} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value} className={selectItemClass}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
