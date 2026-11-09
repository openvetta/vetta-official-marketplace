import { Switch } from "./switch";

interface ToggleRowProps {
  title: string;
  description?: string;
  checked: boolean;
  onChange(checked: boolean): void;
}

export function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} label={title} onChange={onChange} />
    </div>
  );
}
