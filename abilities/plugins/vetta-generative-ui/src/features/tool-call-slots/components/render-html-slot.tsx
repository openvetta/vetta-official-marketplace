import { type PluginToolCallSlotProps, useTranslation } from "@vetta-org/plugin-sdk";
import { useMemo } from "react";
import { htmlDocumentSchema } from "../../../domain/ui-schema";
import type { GenerativeUiDeps } from "../../../shared/state/generative-ui-deps";
import { HtmlView } from "../../html-view/components/html-view";
import { ToolNotice } from "./tool-notice";
import { ViewSkeleton } from "./view-skeleton";

/** HTML is only mounted after the call completes; re-mounting an iframe per streamed token would flicker and re-run scripts. */
export function RenderHtmlSlot({ toolCall, deps }: PluginToolCallSlotProps & { deps: GenerativeUiDeps }) {
    const { t } = useTranslation();
    const parsed = useMemo(() => htmlDocumentSchema.safeParse(toolCall.args), [toolCall.args]);

    if (toolCall.status === "cancelled") return <ToolNotice title={t("state.cancelled")} />;
    if (toolCall.status === "error" || toolCall.isError) return <ToolNotice title={t("error.invalidHtml")} detail={toolCall.result} />;
    if (toolCall.status === "pending") {
        const length = typeof toolCall.args.html === "string" ? toolCall.args.html.length : 0;
        return <ViewSkeleton label={length ? t("state.writingHtml", { count: length.toLocaleString() }) : t("state.generatingView")} />;
    }
    if (!parsed.success) return <ToolNotice title={t("error.invalidHtml")} />;
    return <HtmlView document={parsed.data} deps={deps} />;
}
