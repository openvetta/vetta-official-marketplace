import { Button, Input } from "@vetta-org/ui";
import { useId, type ReactNode } from "react";

interface TextFieldProps {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange(value: string): void;
  trailing?: ReactNode;
}

export function TextField({ label, hint, value, placeholder, onChange, trailing }: TextFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          className={trailing ? "pr-9" : undefined}
          placeholder={placeholder}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {trailing ? <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </div>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Sits inside a `TextField`'s `trailing` slot: a host icon button that never leaves the field. */
export function FieldAction({ label, onClick, children }: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon-xs" aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  );
}
