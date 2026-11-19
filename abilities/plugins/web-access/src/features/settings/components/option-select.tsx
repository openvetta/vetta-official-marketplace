import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@vetta-org/ui";

interface OptionSelectProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange(value: string): void;
  ariaLabel: string;
  className?: string;
}

/** Exclusive choice rendered with the host's select, the same control the app's settings pages use. */
export function OptionSelect({ value, options, onChange, ariaLabel, className = "w-full" }: OptionSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
