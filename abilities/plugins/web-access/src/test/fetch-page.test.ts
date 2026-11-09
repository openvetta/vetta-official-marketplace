import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type WebAccessSettings } from "../domain/settings";
import type { NetworkCall, NetworkResult } from "../services/network";
import { fetchPage, parseJinaOutput } from "../services/fetch-page";

const settings: WebAccessSettings = { ...DEFAULT_SETTINGS, maxChars: 4000 };

const ok = (body: string, headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" }): NetworkResult => ({
  ok: true,
  status: 200,
  statusText: "OK",
  headers,
  body
});

const ARTICLE = `<html><head><title>Report</title></head><body><article>
<h1>Report</h1>
<p>The number is 42 and it grew by eight percent this quarter, according to the filing published today. Analysts expected 39, so the result beat guidance, and the company kept its full-year outlook unchanged.</p>
<p>This paragraph exists so the extractor sees enough text to treat the page as an article rather than navigation. It repeats the important facts with enough words for the readability threshold, which otherwise falls back to the whole body and makes the test meaningless.</p>
</article></body></html>`;

function fake(handler: (call: NetworkCall) => NetworkResult) {
  const calls: NetworkCall[] = [];
  return {
    calls,
    call: async (request: NetworkCall) => {
      calls.push(request);
      return handler(request);
    }
  };
}

describe("page reading", () => {
  it("reads html directly and converts it to markdown", async () => {
    const { call, calls } = fake(() => ok(ARTICLE));
    const page = await fetchPage({ call, settings, secret: async () => undefined }, "https://example.com/report");
    expect(page.reader).toBe("direct");
    expect(page.title).toBe("Report");
    expect(page.content).toContain("The number is 42");
    expect(calls[0].headers?.["User-Agent"]).toContain("VettaWebAccess");
  });

  it("blocks loopback and private hosts unless the user allows them", async () => {
    const { call } = fake(() => ok("a plain text body", { "content-type": "text/plain" }));
    await expect(fetchPage({ call, settings, secret: async () => undefined }, "http://127.0.0.1:3000")).rejects.toThrow(
      /private network address|loopback/u
    );
    await expect(
      fetchPage({ call, settings: { ...settings, allowPrivateHosts: true }, secret: async () => undefined }, "http://127.0.0.1:3000")
    ).resolves.toMatchObject({ reader: "direct" });
  });

  it("falls back to the hosted reader when the page is a PDF", async () => {
    const { call, calls } = fake((request) => {
      if (request.url === "https://example.com/file.pdf") {
        return ok("%PDF-1.7 binary", { "content-type": "application/pdf" });
      }
      const body = request.json as { method: string };
      if (body.method === "initialize") {
        return { ok: true, status: 200, statusText: "OK", headers: { "mcp-session-id": "s" }, body: 'event: message\ndata: {"result":{}}\n\n' };
      }
      return ok(
        'event: message\ndata: {"result":{"content":[{"type":"text","text":"# Annual report\\n\\nText from the PDF."}]}}\n\n',
        { "content-type": "text/event-stream" }
      );
    });
    const page = await fetchPage({ call, settings, secret: async () => undefined }, "https://example.com/file.pdf");
    expect(page.reader).toBe("exa");
    expect(page.title).toBe("Annual report");
    expect(page.content).toContain("Text from the PDF");
    expect(calls.some((item) => item.url === "https://mcp.exa.ai/mcp")).toBe(true);
  });

  it("stays local when remote fallback is off", async () => {
    const { call, calls } = fake(() => ({ ok: false, status: 403, statusText: "Forbidden", headers: {}, body: "blocked" }));
    await expect(
      fetchPage(
        { call, settings: { ...settings, remoteFallback: false }, secret: async () => undefined },
        "https://example.com/blocked"
      )
    ).rejects.toThrow(/Could not read/u);
    expect(calls).toHaveLength(1);
  });

  it("returns plain text when asked", async () => {
    const { call } = fake(() => ok(ARTICLE));
    const page = await fetchPage({ call, settings, secret: async () => undefined }, "https://example.com/report", {
      format: "text"
    });
    expect(page.content).toContain("The number is 42");
    expect(page.content).not.toContain("#");
  });

  it("splits Jina's header from the content", () => {
    const parsed = parseJinaOutput("Title: Example\nURL Source: https://example.com\n\nMarkdown Content:\n# Hi\n\nBody");
    expect(parsed.title).toBe("Example");
    expect(parsed.content).toBe("# Hi\n\nBody");
  });
});
