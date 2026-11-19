import { Switch as HostSwitch } from "@vetta-org/ui";

interface SwitchProps {
  checked: boolean;
  label: string;
  onChange(value: boolean): void;
}

/** A bare on/off control; the row that owns it supplies the visible label. */
export function Switch({ checked, label, onChange }: SwitchProps) {
  return <HostSwitch checked={checked} aria-label={label} onCheckedChange={onChange} />;
}
