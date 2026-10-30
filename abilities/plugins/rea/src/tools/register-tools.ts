import type { Disposable, PluginAgentToolRegistration, PluginContext } from "@vetta-org/plugin-sdk";
import { caseOpenTool } from "./case-open";
import { caseRecordTool } from "./case-record";
import { caseReportTool } from "./case-report";
import { caseStatusTool } from "./case-status";

/**
 * Four tools are the whole interface: open the case, record into it, read it
 * back, render it. Everything else the user does is a REA tool call.
 */
const tools: Array<PluginAgentToolRegistration<Record<string, unknown>>> = [
	caseOpenTool as unknown as PluginAgentToolRegistration<Record<string, unknown>>,
	caseRecordTool as unknown as PluginAgentToolRegistration<Record<string, unknown>>,
	caseStatusTool as unknown as PluginAgentToolRegistration<Record<string, unknown>>,
	caseReportTool as unknown as PluginAgentToolRegistration<Record<string, unknown>>,
];

export function registerCaseTools(ctx: PluginContext): Disposable[] {
	return tools.map((tool) => ctx.agent.registerTool(tool));
}
