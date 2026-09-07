import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta/ui";
import { BookOpen } from "lucide-react";
import type { ReactElement } from "react";
import type { LibraryEntry } from "../../domain";
import { ImportButton } from "./ImportButton";

interface LibrarySidebarProps {
  entries: LibraryEntry[];
  selectedId?: string;
  open: boolean;
  t: PluginTranslate;
  onSelect(id: string): Promise<void>;
  onFiles(files: FileList): Promise<void>;
}

export function LibrarySidebar({ entries, selectedId, open, t, onSelect, onFiles }: LibrarySidebarProps): ReactElement {
  return (
    <aside
      aria-label={t("library.title")}
      aria-hidden={!open}
      inert={!open}
      className={`shimo-library-panel min-h-0 overflow-hidden border-r border-border/50 bg-card/35 transition-[width,opacity] duration-200 ${open ? "w-56 opacity-100" : "w-0 border-r-0 opacity-0"}`}
    >
      <div className="flex h-full w-56 flex-col px-3 pb-3 pt-4">
        <div className="mb-4 flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <BookOpen className="size-[18px] text-primary" />
            <span className="truncate">{t("library.title")}</span>
          </div>
          <ImportButton t={t} onFiles={onFiles} />
        </div>

        <nav className="shimo-scroll min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label={t("library.materials")}> 
          {entries.map((entry) => {
            const active = selectedId === entry.id;
            return (
              <Button
                key={entry.id}
                type="button"
                size="lg"
                variant={active ? "secondary" : "ghost"}
                aria-current={active ? "page" : undefined}
                onClick={() => void onSelect(entry.id)}
                className="relative grid h-auto w-full justify-start gap-1 rounded-xl px-3 py-2.5 text-left whitespace-normal"
              >
                {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                <span className="truncate text-[13px] font-medium">{entry.title}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{entry.kind}</span>
              </Button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
