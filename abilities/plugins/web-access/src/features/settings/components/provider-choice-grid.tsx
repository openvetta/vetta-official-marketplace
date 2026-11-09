import type { IconName } from "../../../shared/components/icon";
import { Icon } from "../../../shared/components/icon";

export interface ProviderChoice {
  value: string;
  label: string;
  description?: string;
  /** Short qualifier shown next to the name, e.g. "No key" or "API key". */
  badge?: string;
  monogram?: string;
  icon?: IconName;
  /** The recommended default gets the full width instead of half a row. */
  featured?: boolean;
}

interface ProviderChoiceGridProps {
  value: string;
  options: ProviderChoice[];
  onChange(value: string): void;
  name: string;
  ariaLabel: string;
}

/**
 * Provider selection as tiles rather than a dropdown: which service answers is
 * the page's main decision, and the qualifiers ("no key", "self-hosted") are
 * what the choice actually turns on.
 */
export function ProviderChoiceGrid({ value, options, onChange, name, ariaLabel }: ProviderChoiceGridProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={`group relative flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-all ${
              option.featured ? "sm:col-span-2" : ""
            } ${
              selected
                ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/25"
                : "border-border/60 bg-muted/25 hover:border-border hover:bg-muted/50"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${
                selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {option.icon ? <Icon name={option.icon} className="h-3.5 w-3.5" /> : (option.monogram ?? "?")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-foreground">{option.label}</span>
                {option.badge ? (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-px text-[10px] leading-4 ${
                      selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {option.badge}
                  </span>
                ) : null}
              </span>
              {option.description ? (
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
