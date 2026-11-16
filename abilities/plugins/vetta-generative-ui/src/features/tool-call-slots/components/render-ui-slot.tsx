import { type PluginToolCallSlotProps, useTranslation } from "@vetta-org/plugin-sdk";
import { useMemo } from "react";
import { uiDocumentSchema } from "../../../domain/ui-schema";
import type { GenerativeUiDeps } from "../../../shared/state/generative-ui-deps";
import { UiView } from "../../declarative-ui/components/ui-view";
import { useInteractions } from "../../declarative-ui/hooks/use-interactions";
import type { ViewEnv } from "../../declarative-ui/view-env";
import { ToolNotice } from "./tool-notice";
import { ViewSkeleton } from "./view-skeleton";

/** Replaces the render_ui transcript row with the view itself. The view is mounted once, when the call succeeds. */
export function RenderUiSlot({ toolCall, deps }: PluginToolCallSlotProps & { deps: GenerativeUiDeps }) {
    const { t } = useTranslation();
    const parsed = useMemo(() => uiDocumentSchema.safeParse(toolCall.args), [toolCall.args]);
    const { records, record } = useInteractions(deps, toolCall.toolCallId);

    if (toolCall.status === "cancelled") return <ToolNotice title={t("state.cancelled")} />;
    if (toolCall.status === "error" || toolCall.isError) return <ToolNotice title={t("error.invalidView")} detail={toolCall.result} />;
    // Streamed arguments are partial and change on every token: rendering them makes the layout jump
    // as blocks appear and the parse flips between valid and invalid. Hold a stable skeleton until done.
    if (toolCall.status === "pending") return <ViewSkeleton label={t("state.generatingView")} />;
    if (!parsed.success) return <ToolNotice title={t("error.invalidView")} />;
    const env: ViewEnv = { deps, interactive: true, records, record };
    return <UiView document={parsed.data} env={env} />;
}
