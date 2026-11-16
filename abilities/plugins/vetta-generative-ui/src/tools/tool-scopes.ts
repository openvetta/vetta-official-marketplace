import type { ConversationScenario } from "@vetta-org/plugin-sdk";

/** Interactive chat scenarios only: batch, automation and IM channels have nowhere to show a view. */
export const GENERATIVE_UI_SCOPES: readonly ConversationScenario[] = ["conversation", "project"];

export const RENDER_UI_TOOL = "render_ui";
export const RENDER_HTML_TOOL = "render_html";
