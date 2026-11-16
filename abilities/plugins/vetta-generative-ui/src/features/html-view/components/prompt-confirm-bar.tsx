import { useTranslation } from "@vetta-org/plugin-sdk";
import { Button } from "@vetta-org/ui";

interface PromptConfirmBarProps {
    text: string;
    sending: boolean;
    onConfirm(): void;
    onCancel(): void;
}

/** The sandboxed view is untrusted, so anything it wants to send is shown to the user first. */
export function PromptConfirmBar({ text, sending, onConfirm, onCancel }: PromptConfirmBarProps) {
    const { t } = useTranslation();
    return (
        <div role="dialog" aria-label={t("html.confirmTitle")} className="bg-muted/60 px-4 py-3.5">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t("html.confirmTitle")}</div>
            <p className="max-h-32 overflow-auto rounded-lg bg-background px-3 py-2 shadow-xs text-sm whitespace-pre-wrap text-foreground">{text}</p>
            <div className="mt-2.5 flex justify-end gap-2">
                <Button type="button" variant="ghost" disabled={sending} onClick={onCancel}>
                    {t("common.cancel")}
                </Button>
                <Button type="button" variant="primary" disabled={sending} onClick={onConfirm}>
                    {sending ? <span aria-hidden="true" className="icon-[solar--refresh-linear] size-4 animate-spin" /> : null}
                    {t("html.send")}
                </Button>
            </div>
        </div>
    );
}
