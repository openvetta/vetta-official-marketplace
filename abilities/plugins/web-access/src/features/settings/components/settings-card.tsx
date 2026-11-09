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
 * The page's only container. A quiet border and one elevation step keep the
 * sections readable without turning the page into a stack of boxes.
 */
export function SettingsCard({ title, description, icon, actions, children, className = "" }: SettingsCardProps) {
  return (
    <section
      className={`rounded-2xl border border-border/60 bg-card/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      <header className="flex items-start gap-3 px-5 pb-4 pt-5">
        {icon ? (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="space-y-4 px-5 pb-5">{children}</div>
    </section>
  );
}
