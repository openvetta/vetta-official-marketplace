import { type ReactElement } from "react";

/** A model row's tick box. Native input so keyboard and screen readers work as usual. */
export function Checkbox({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}): ReactElement {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}
