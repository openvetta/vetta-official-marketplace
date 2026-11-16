import { useTranslation } from "@vetta-org/plugin-sdk";
import { useState } from "react";
import type { ActionsBlock as ActionsBlockSpec } from "../../../domain/ui-schema";
import { Button } from "@vetta-org/ui";
import type { ViewEnv } from "../view-env";

export function ActionsBlock({ block, path, env }: { block: ActionsBlockSpec; path: string; env: ViewEnv }) {
    const { t } = useTranslation();
    const [sending, setSending] = useState<string | null>(null);
    const chosen = env.records[path]?.choice;
    const locked = !env.interactive || chosen !== undefined || sending !== null;

    const choose = async (label: string, prompt: string) => {
        if (locked) return;
        setSending(label);
        try {
            const result = await env.deps.sendPrompt(prompt);
            if (result.status === "failed") throw new Error(result.error?.message ?? "sendPrompt failed");
            await env.record(path, { kind: "action", at: Date.now(), choice: label });
        } catch (error) {
            env.deps.notify({ message: t("error.send"), error });
        } finally {
            setSending(null);
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {block.buttons.map((button, index) => {
                const isChosen = chosen === button.label;
                const variant = isChosen ? "primary" : (button.variant ?? (index === 0 ? "primary" : "secondary"));
                return (
                    <Button
                        key={`${button.label}-${index}`}
                        type="button"
                        variant={chosen !== undefined && !isChosen ? "secondary" : variant}
                        disabled={locked}
                        aria-pressed={chosen !== undefined ? isChosen : undefined}
                        className={isChosen ? "disabled:opacity-100" : undefined}
                        onClick={() => choose(button.label, button.prompt)}
                    >
                        {isChosen ? <span aria-hidden="true" className="icon-[solar--check-read-linear] size-4" /> : null}
                        {sending === button.label ? <span aria-hidden="true" className="icon-[solar--refresh-linear] size-4 animate-spin" /> : null}
                        {button.label}
                    </Button>
                );
            })}
        </div>
    );
}
