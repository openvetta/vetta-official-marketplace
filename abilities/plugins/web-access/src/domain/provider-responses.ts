import { z } from "zod";
import type { SearchHit } from "./search-types";

const text = z.string().catch("");
const optionalText = z.string().nullish().catch(null);

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#0?39;/gu, "'")
    .replace(/&#x27;/giu, "'")
    .replace(/&hellip;/gu, "…")
    .replace(/&mdash;/gu, "—")
    .replace(/&ndash;/gu, "–");
}

/** Brave and some SearXNG engines return highlighted HTML in their snippets. */
export function plainSnippet(value: string, limit = 400): string {
  const cleaned = decodeEntities(value.replace(/<[^>]*>/gu, " ")).replace(/\s+/gu, " ").trim();
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}

function cleanTitle(value: string, fallbackUrl: string): string {
  const title = plainSnippet(value, 300);
  if (title) return title;
  try {
    return new URL(fallbackUrl).hostname;
  } catch {
    return fallbackUrl;
  }
}

function dropInvalid(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    if (!/^https?:\/\//u.test(hit.url) || seen.has(hit.url)) return false;
    seen.add(hit.url);
    return true;
  });
}

const braveSchema = z.object({
  web: z
    .object({
      results: z
        .array(
          z.object({
            title: text,
            url: text,
            description: text,
            age: optionalText,
            page_age: optionalText
          })
        )
        .catch([])
    })
    .nullish()
});

export function parseBraveResults(payload: unknown): SearchHit[] {
  const parsed = braveSchema.safeParse(payload);
  if (!parsed.success) return [];
  const results = parsed.data.web?.results ?? [];
  return dropInvalid(
    results.map((result) => ({
      title: cleanTitle(result.title, result.url),
      url: result.url,
      snippet: plainSnippet(result.description),
      published: result.page_age ?? result.age ?? undefined
    }))
  );
}

const tavilySchema = z.object({
  results: z
    .array(
      z.object({
        title: text,
        url: text,
        content: text,
        published_date: optionalText
      })
    )
    .catch([])
});

export function parseTavilyResults(payload: unknown): SearchHit[] {
  const parsed = tavilySchema.safeParse(payload);
  if (!parsed.success) return [];
  return dropInvalid(
    parsed.data.results.map((result) => ({
      title: cleanTitle(result.title, result.url),
      url: result.url,
      snippet: plainSnippet(result.content),
      published: result.published_date ?? undefined
    }))
  );
}

const bochaSchema = z.object({
  data: z
    .object({
      webPages: z
        .object({
          value: z
            .array(
              z.object({
                name: text,
                url: text,
                snippet: text,
                summary: optionalText,
                datePublished: optionalText
              })
            )
            .catch([])
        })
        .nullish()
    })
    .nullish()
});

export function parseBochaResults(payload: unknown): SearchHit[] {
  const parsed = bochaSchema.safeParse(payload);
  if (!parsed.success) return [];
  const results = parsed.data.data?.webPages?.value ?? [];
  return dropInvalid(
    results.map((result) => ({
      title: cleanTitle(result.name, result.url),
      url: result.url,
      snippet: plainSnippet(result.summary || result.snippet),
      published: result.datePublished ?? undefined
    }))
  );
}

const searxngSchema = z.object({
  results: z
    .array(
      z.object({
        title: text,
        url: text,
        content: text,
        publishedDate: optionalText
      })
    )
    .catch([])
});

export function parseSearxngResults(payload: unknown): SearchHit[] {
  const parsed = searxngSchema.safeParse(payload);
  if (!parsed.success) return [];
  return dropInvalid(
    parsed.data.results.map((result) => ({
      title: cleanTitle(result.title, result.url),
      url: result.url,
      snippet: plainSnippet(result.content),
      published: result.publishedDate ?? undefined
    }))
  );
}

const exaSchema = z.object({
  results: z
    .array(
      z.object({
        title: optionalText,
        url: text,
        text: optionalText,
        summary: optionalText,
        publishedDate: optionalText
      })
    )
    .catch([])
});

export function parseExaResults(payload: unknown): SearchHit[] {
  const parsed = exaSchema.safeParse(payload);
  if (!parsed.success) return [];
  return dropInvalid(
    parsed.data.results.map((result) => ({
      title: cleanTitle(result.title ?? "", result.url),
      url: result.url,
      snippet: plainSnippet(result.summary || result.text || ""),
      published: result.publishedDate ?? undefined
    }))
  );
}

/**
 * Exa's keyless MCP tool answers with one markdown-ish block per result:
 *
 *   Title: ...
 *   URL: ...
 *   Published: ...
 *   Author: ...
 *   Highlights:
 *   ...
 */
export function parseExaMcpText(value: string): SearchHit[] {
  const blocks = value.split(/^(?=Title: )/mu).filter((block) => block.includes("URL:"));
  const hits: SearchHit[] = [];
  for (const block of blocks) {
    const title = /^Title: (.*)$/mu.exec(block)?.[1]?.trim() ?? "";
    const url = /^URL: (.*)$/mu.exec(block)?.[1]?.trim() ?? "";
    const published = /^Published: (.*)$/mu.exec(block)?.[1]?.trim();
    const body = block.split(/^Highlights:\s*$/mu)[1] ?? block.replace(/^(?:Title|URL|Published|Author):.*$/gmu, "");
    const snippet = body.replace(/^\.\.\.$/gmu, "").trim();
    if (!url) continue;
    hits.push({
      title: cleanTitle(title, url),
      url,
      snippet: plainSnippet(snippet, 600),
      published: published && published !== "N/A" ? published : undefined
    });
  }
  return dropInvalid(hits);
}
