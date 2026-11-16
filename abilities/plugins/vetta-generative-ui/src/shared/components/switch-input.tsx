import { Switch } from "@vetta-org/ui";

interface SwitchInputProps {
    id: string;
    label: string;
    checked: boolean;
    disabled?: boolean;
    onChange(checked: boolean): void;
}

export function SwitchInput({ id, label, checked, disabled, onChange }: SwitchInputProps) {
    return (
        <div className="flex items-center justify-between gap-4">
            <label htmlFor={id} className="text-sm text-foreground">
                {label}
            </label>
            <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
        </div>
    );
}
