import type { Disposable, PluginContext } from "@vetta-org/plugin-sdk";
import { buildHandoff } from "../domain/memory-context";
import type { MemoryServices } from "../domain/memory-services";
import { SessionTracker } from "../domain/session-tracker";
import { extractMemories, type AiDeps } from "./auto-extractor";
import { summarizeSession } from "./session-summarizer";

const SCOPES = ["conversation", "project"] as const;

/**
 * Lifecycle wiring. Every handler returns immediately: hooks time out after
 * seconds while model calls take longer, so slow work runs detached.
 *  - SessionStart / PostCompact: refresh the stable prompt snapshot.
 *  - UserPromptSubmit / Stop: buffer the exchange, then extract memories.
 *  - PreCompact: save a handoff entry so open work survives compaction.
 *  - SessionEnd: write a short session summary to the daily log.
 */
export function registerHooks(ctx: PluginContext, services: MemoryServices): Disposable[] {
    const tracker = new SessionTracker();
    const ai: AiDeps = {
        services,
        complete: (request) => ctx.ai.complete(request),
        onError: (message, error) => ctx.ui.notify({ message, error }),
    };
    const report = (message: string) => (error: unknown) => ctx.ui.notify({ message, error });

    return [
        ctx.agent.registerHook({
            id: "memory-session-start",
            eventName: "SessionStart",
            scope_use: SCOPES,
            handler({ event }) {
                services.snapshots.invalidate(event.sessionId);
            },
        }),
        ctx.agent.registerHook({
            id: "memory-track-prompt",
            eventName: "UserPromptSubmit",
            scope_use: SCOPES,
            handler({ event }) {
                if (!event.subagent) tracker.recordPrompt(event.sessionId, event.prompt);
            },
        }),
        ctx.agent.registerHook({
            id: "memory-turn-end",
            eventName: "Stop",
            scope_use: SCOPES,
            handler({ event }) {
                if (event.subagent || event.stopHookActive) return;
                const exchange = tracker.recordReply(event.sessionId, event.lastAssistantMessage);
                if (exchange) void extractMemories(ai, event.cwd, exchange);
            },
        }),
        // The SDK types PreCompact and PostCompact as one shared event shape, so both
        // register through the same union and branch on `eventName` at runtime.
        ...(["PreCompact", "PostCompact"] as const).map((eventName) =>
            ctx.agent.registerHook({
                id: `memory-${eventName === "PreCompact" ? "pre" : "post"}-compact`,
                eventName,
                scope_use: SCOPES,
                async handler({ event }) {
                    if (event.subagent) return;
                    if (event.eventName === "PreCompact") {
                        try {
                            const handoff = await buildHandoff(services, event.cwd, Date.now());
                            if (handoff) await services.daily.append(handoff, { kind: "handoff", cwd: event.cwd });
                        } catch (error) {
                            report("Could not save the session handoff")(error);
                        }
                    }
                    services.snapshots.invalidate(event.sessionId);
                },
            }),
        ),
        ctx.agent.registerHook({
            id: "memory-session-end",
            eventName: "SessionEnd",
            scope_use: SCOPES,
            handler({ event }) {
                if (event.subagent) return;
                services.snapshots.invalidate(event.sessionId);
                void summarizeSession(ai, event.cwd, tracker.take(event.sessionId));
            },
        }),
    ];
}
