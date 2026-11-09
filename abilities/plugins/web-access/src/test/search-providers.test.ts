import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type WebAccessSettings } from "../domain/settings";
import type { NetworkCall, NetworkResult } from "../services/network";
import { resolveAutoOrder, searchWeb } from "../services/search-providers";

const settings: WebAccessSettings = { ...DEFAULT_SETTINGS };

function makeCall(handler: (call: NetworkCall) => NetworkResult | Promise<NetworkResult>) {
  const calls: NetworkCall[] = [];
  const call = async (request: NetworkCall) => {
    calls.push(request);
    return handler(request);
  };
  return { call, calls };
}

const ok = (body: string, headers: Record<string, string> = {}): NetworkResult => ({
  ok: true,
  status: 200,
  statusText: "OK",
  headers,
  body
});

function sse(payload: unknown): string {
  return `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
}

describe("search routing", () => {
  it("uses the free Exa endpoint when nothing is configured", async () => {
    const { call, calls } = makeCall((request) => {
      const body = request.json as { method: string };
      if (body.method === "initialize") {
        return ok(sse({ result: { serverInfo: { name: "exa" } } }), { "mcp-session-id": "session-1" });
      }
      return ok(
        sse({
          result: {
            content: [{ type: "text", text: "Title: Vetta\nURL: https://openvetta.com\nHighlights:\nOpen source agents." }]
          }
        })
      );
    });

    const outcome = await searchWeb({ call, settings, secret: async () => undefined }, { query: "vetta", count: 3 });

    expect(outcome.provider).toBe("exa-mcp");
    expect(outcome.results[0]).toMatchObject({ title: "Vetta", url: "https://openvetta.com" });
    expect(calls[0].url).toBe("https://mcp.exa.ai/mcp");
  });

  it("puts configured providers ahead of the free one", async () => {
    const order = await resolveAutoOrder({
      call: async () => ok(""),
      settings: { ...settings, searxngUrl: "https://search.example.com" },
      secret: async (key) => (key === "braveApiKey" ? "key" : undefined)
    });
    expect(order).toEqual(["searxng", "brave", "exa-mcp"]);
  });

  it("falls back when a keyed provider fails", async () => {
    const skipped: string[] = [];
    const { call } = makeCall((request) => {
      if (request.url.startsWith("https://api.search.brave.com")) {
        return { ok: false, status: 401, statusText: "Unauthorized", headers: {}, body: '{"message":"bad key"}' };
      }
      const body = request.json as { method: string };
      if (body.method === "initialize") {
        return ok(sse({ result: {} }), { "mcp-session-id": "s" });
      }
      return ok(sse({ result: { content: [{ type: "text", text: "Title: Fallback\nURL: https://fallback.example\nHighlights:\nok" }] } }));
    });

    const outcome = await searchWeb(
      { call, settings, secret: async (key) => (key === "braveApiKey" ? "key" : undefined) },
      { query: "q", count: 2 }
    );
    expect(outcome.provider).toBe("exa-mcp");
    skipped.push(...outcome.skipped.map((item) => item.provider));
    expect(skipped).toEqual(["brave"]);
  });

  it("explains a missing key instead of silently switching providers", async () => {
    const { call } = makeCall(() => ok(""));
    await expect(
      searchWeb({ call, settings: { ...settings, searchProvider: "brave" }, secret: async () => undefined }, { query: "q", count: 2 })
    ).rejects.toThrow(/Brave Search needs an API key/u);
  });

  it("reports every provider's reason when nothing answers", async () => {
    const { call } = makeCall((request) => {
      if ((request.json as { method?: string })?.method === "initialize") return ok(sse({ result: {} }), { "mcp-session-id": "s" });
      return { ok: false, status: 429, statusText: "Too Many Requests", headers: {}, body: "slow down" };
    });
    await expect(searchWeb({ call, settings, secret: async () => undefined }, { query: "q", count: 2 })).rejects.toThrow(
      /No search provider could answer/u
    );
  });
});
