import { describe, expect, it } from "vitest";
import {
  parseBochaResults,
  parseBraveResults,
  parseExaMcpText,
  parseExaResults,
  parseSearxngResults,
  parseTavilyResults
} from "../domain/provider-responses";

describe("provider responses", () => {
  it("reads Brave results and strips highlight markup", () => {
    const hits = parseBraveResults({
      web: {
        results: [
          { title: "Vetta", url: "https://openvetta.com", description: "An <strong>open</strong> agent &amp; tools" }
        ]
      }
    });
    expect(hits).toEqual([
      { title: "Vetta", url: "https://openvetta.com", snippet: "An open agent & tools", published: undefined }
    ]);
  });

  it("reads Tavily results", () => {
    const hits = parseTavilyResults({
      results: [{ title: "Docs", url: "https://example.com/docs", content: "How it works", published_date: "2026-01-02" }]
    });
    expect(hits[0]).toMatchObject({ title: "Docs", url: "https://example.com/docs", published: "2026-01-02" });
  });

  it("reads Bocha web pages", () => {
    const hits = parseBochaResults({
      data: { webPages: { value: [{ name: "博查", url: "https://bochaai.com", snippet: "s", summary: "摘要内容" }] } }
    });
    expect(hits[0]).toMatchObject({ title: "博查", url: "https://bochaai.com", snippet: "摘要内容" });
  });

  it("reads SearXNG results", () => {
    const hits = parseSearxngResults({
      results: [{ title: "A", url: "https://a.example", content: "text", publishedDate: "2025-01-01" }]
    });
    expect(hits[0]).toMatchObject({ title: "A", url: "https://a.example", published: "2025-01-01" });
  });

  it("reads Exa API results", () => {
    const hits = parseExaResults({ results: [{ title: "Exa", url: "https://exa.ai", text: "Semantic search" }] });
    expect(hits[0]).toMatchObject({ title: "Exa", url: "https://exa.ai", snippet: "Semantic search" });
  });

  it("parses the free Exa MCP answer format", () => {
    const text = [
      "Title: Vetta — Open-Source Agents",
      "URL: https://www.openvetta.com/",
      "Published: N/A",
      "Author: N/A",
      "Highlights:",
      "Vetta is built for work and coding.",
      "",
      "Title: Second page",
      "URL: https://example.com/second",
      "Published: 2026-02-01",
      "Author: Jane",
      "Highlights:",
      "Snippet here."
    ].join("\n");
    const hits = parseExaMcpText(text);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ title: "Vetta — Open-Source Agents", url: "https://www.openvetta.com/" });
    expect(hits[0].published).toBeUndefined();
    expect(hits[1].published).toBe("2026-02-01");
  });

  it("drops duplicates and non-http URLs", () => {
    const hits = parseSearxngResults({
      results: [
        { title: "A", url: "https://a.example", content: "" },
        { title: "A again", url: "https://a.example", content: "" },
        { title: "Bad", url: "javascript:alert(1)", content: "" }
      ]
    });
    expect(hits).toHaveLength(1);
  });

  it("survives a provider returning an unexpected shape", () => {
    expect(parseBraveResults({ web: "nope" })).toEqual([]);
    expect(parseTavilyResults(null)).toEqual([]);
    expect(parseBochaResults({ data: null })).toEqual([]);
  });
});
