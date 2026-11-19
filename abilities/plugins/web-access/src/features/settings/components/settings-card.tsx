import type { ReactNode } from "react";
import { Icon, type IconName } from "../../../shared/components/icon";

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The page's only container, on the same card surface the app's own settings
 * pages use: one border, one radius, no extra elevation.
 */
export function SettingsCard({ title, description, icon, actions, children, className = "" }: SettingsCardProps) {
  return (
    <section className={`rounded-xl border border-border/60 bg-card text-card-foreground ${className}`}>
      <header className="flex items-start gap-3 px-4 pb-3 pt-4">
        {icon ? (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="space-y-4 px-4 pb-4">{children}</div>
    </section>
  );
}
