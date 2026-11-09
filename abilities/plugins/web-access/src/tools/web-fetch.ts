import type { PluginAgentHandlerContext, PluginAgentToolRegistration } from "@vetta-org/plugin-sdk";
import type { NetworkRequest } from "../services/network";
import { fetchPage, type FetchFormat } from "../services/fetch-page";
import type { WebAccessStore } from "../services/settings-store";

interface WebFetchInput {
  url: string;
  maxChars?: number;
  format?: FetchFormat;
}

export function createWebFetchTool(store: WebAccessStore, call: NetworkRequest): PluginAgentToolRegistration<WebFetchInput> {
  return {
    id: "web-fetch",
    name: "web_fetch",
    label: "%tool.fetch.label%",
    description:
      "Read a web page or PDF as clean Markdown. Use it on a URL the user gave you or one web_search returned, when you need the actual content, numbers or wording rather than a snippet. Pages behind a login, a payment or a cookie wall usually come back thin — say so instead of guessing. Do not use it to browse an interactive app; this tool reads, it does not click.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute http(s) URL to read." },
        maxChars: {
          type: "integer",
          minimum: 500,
          maximum: 50000,
          description: "Maximum characters to return. Omit to use the user's configured limit."
        },
        format: {
          type: "string",
          enum: ["markdown", "text"],
          description: "markdown keeps headings, links and lists; text flattens them. Default markdown."
        }
      },
      required: ["url"]
    },
    scope_use: ["conversation", "project", "im-claw", "automation", "kb-processing", "batch", "cli"],
    timeoutMs: 120_000,
    handler: async ({ trigger }: PluginAgentHandlerContext<{ kind: "tool-call"; input: WebFetchInput }>) => {
      const input = trigger.input;
      const url = String(input.url ?? "").trim();
      if (!url) throw new Error("url is required");

      const settings = await store.ready();
      const outcome = await fetchPage(
        { call, settings, secret: store.secret },
        url,
        { maxChars: input.maxChars, format: input.format ?? "markdown" }
      );

      return {
        requestedUrl: outcome.url,
        finalUrl: outcome.finalUrl,
        title: outcome.title,
        reader: outcome.reader,
        truncated: outcome.truncated,
        chars: outcome.chars,
        content: outcome.content,
        note:
          outcome.reader === "direct"
            ? "Read from the page itself."
            : `Read through ${outcome.reader === "exa" ? "Exa's free reader" : "Jina Reader"} because the page could not be read directly.`
      };
    }
  };
}
