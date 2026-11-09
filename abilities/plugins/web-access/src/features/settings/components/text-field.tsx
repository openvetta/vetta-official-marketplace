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
        <input
          id={id}
          className={`w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-xs text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 ${
            trailing ? "pr-9" : ""
          }`}
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
