import { useTranslation } from "@vetta-org/plugin-sdk";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { buildHtmlDocument, themeMessage } from "../../../domain/html-document";
import type { HtmlDocument } from "../../../domain/ui-schema";
import type { GenerativeUiDeps } from "../../../shared/state/generative-ui-deps";
import { useHostPalette } from "../hooks/use-host-palette";
import { useHtmlBridge } from "../hooks/use-html-bridge";
import { useSandboxLibs } from "../hooks/use-sandbox-libs";
import { PaletteProbe } from "./palette-probe";
import { PromptConfirmBar } from "./prompt-confirm-bar";

/**
 * `sandbox="allow-scripts"` without `allow-same-origin`: the view gets an opaque origin and
 * cannot reach the host DOM, storage, cookies or plugin APIs. Popups, top navigation and
 * forms stay blocked. The document's own CSP blocks fetch/XHR/WebSocket.
 */
export const HTML_SANDBOX = "allow-scripts";

/** No scrollbar: content fades out at the edge that still has more to scroll to. */
function fadeMask({ top, bottom }: { top: boolean; bottom: boolean }): CSSProperties {
    if (top && bottom) return {};
    const mask = `linear-gradient(to bottom, ${top ? "#000" : "transparent"} 0, #000 ${top ? "0" : "40px"}, #000 calc(100% - ${bottom ? "0px" : "48px"}), ${bottom ? "#000" : "transparent"} 100%)`;
    return { maskImage: mask, WebkitMaskImage: mask };
}

export function HtmlView({ document: view, deps }: { document: HtmlDocument; deps: GenerativeUiDeps }) {
    const { t } = useTranslation();
    const probeRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLIFrameElement>(null);
    const palette = useHostPalette(probeRef);
    const { height, edges, pendingPrompt, clearPrompt } = useHtmlBridge(frameRef);
    const libs = useSandboxLibs(view.libs, (error) => deps.notify({ message: t("error.libs"), error }));
    const [sending, setSending] = useState(false);

    // Built once per HTML from the first palette; later theme switches are pushed in, so the view keeps its state.
    const [basePalette, setBasePalette] = useState(palette);
    useEffect(() => {
        if (!palette) return;
        if (!basePalette) setBasePalette(palette);
        else frameRef.current?.contentWindow?.postMessage(themeMessage(palette), "*");
    }, [palette, basePalette]);
    const srcDoc = useMemo(() => (basePalette && libs ? buildHtmlDocument(view.html, basePalette, libs) : null), [view.html, basePalette, libs]);

    const send = async () => {
        if (!pendingPrompt) return;
        setSending(true);
        try {
            const result = await deps.sendPrompt(pendingPrompt);
            if (result.status === "failed") throw new Error(result.error?.message ?? "sendPrompt failed");
            clearPrompt();
        } catch (error) {
            deps.notify({ message: t("error.send"), error });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="relative my-2 w-full max-w-3xl overflow-hidden rounded-2xl bg-muted/50">
            <PaletteProbe probeRef={probeRef} />
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <span aria-hidden="true" className="icon-[solar--code-square-linear] size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{view.title ?? t("html.untitled")}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={t("html.sandboxHint")}>
                    <span aria-hidden="true" className="icon-[solar--shield-check-linear] size-3.5" />
                    {t("html.sandbox")}
                </span>
            </div>
            {srcDoc ? (
                <iframe
                    ref={frameRef}
                    title={view.title ?? t("html.untitled")}
                    sandbox={HTML_SANDBOX}
                    referrerPolicy="no-referrer"
                    srcDoc={srcDoc}
                    className="block w-full border-0 bg-transparent px-2 py-2"
                    style={{ height: view.height ?? height, ...fadeMask(edges) }}
                    onLoad={() => palette && frameRef.current?.contentWindow?.postMessage(themeMessage(palette), "*")}
                />
            ) : (
                <div className="h-[120px]" />
            )}
            {pendingPrompt ? <PromptConfirmBar text={pendingPrompt} sending={sending} onConfirm={send} onCancel={clearPrompt} /> : null}
        </div>
    );
}
