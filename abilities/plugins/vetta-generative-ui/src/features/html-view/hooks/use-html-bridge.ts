import { type RefObject, useEffect, useState } from "react";
import { parseBridgeMessage } from "../../../domain/html-document";

export const MIN_HEIGHT = 120;
export const MAX_AUTO_HEIGHT = 1600;

/**
 * Listens to messages from one sandboxed iframe. Messages are accepted only when their
 * `source` window is that iframe, so other frames on the page cannot spoof a prompt.
 */
export function useHtmlBridge(frameRef: RefObject<HTMLIFrameElement | null>) {
    const [height, setHeight] = useState(MIN_HEIGHT);
    const [edges, setEdges] = useState({ top: true, bottom: true });
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
            const message = parseBridgeMessage(event.data);
            if (!message) return;
            if (message.kind === "resize") setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_AUTO_HEIGHT, Math.ceil(message.height))));
            else if (message.kind === "scroll") setEdges({ top: message.top, bottom: message.bottom });
            else setPendingPrompt(message.text);
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [frameRef]);

    return { height, edges, pendingPrompt, clearPrompt: () => setPendingPrompt(null) };
}
