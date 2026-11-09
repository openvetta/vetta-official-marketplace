import { extractHtmlPage, looksLikeHtml, markdownToPlainText, truncateText } from "../domain/html-extract";
import type { FetchOutcome } from "../domain/search-types";
import { JINA_SECRET_KEY, type WebAccessSettings } from "../domain/settings";
import { parseHttpUrl, privateHostReason } from "../domain/url-guard";
import { exaMcpFetch } from "./exa-mcp-client";
import { expectOk, type NetworkRequest } from "./network";

export interface FetchDependencies {
  call: NetworkRequest;
  settings: WebAccessSettings;
  secret(key: string): Promise<string | undefined>;
}

export type FetchFormat = "markdown" | "text";

const THIN_PAGE_CHARS = 300;
const BROWSER_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
  "Accept-Language": "en,zh-CN;q=0.8,zh;q=0.7",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 VettaWebAccess/1.0"
};

function header(headers: Record<string, string>, name: string): string {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === wanted) return value;
  return "";
}

async function directFetch(deps: FetchDependencies, url: string, maxChars: number): Promise<{ outcome: FetchOutcome }> {
  const response = await expectOk(
    deps.call,
    { url, method: "GET", headers: BROWSER_HEADERS, responseType: "text", timeoutMs: 30_000 },
    "The page"
  );

  const contentType = header(response.headers, "content-type");
  if (/application\/pdf/iu.test(contentType) || /application\/octet-stream/iu.test(contentType)) {
    throw new Error("This address is a binary document, not HTML; it needs the hosted reader.");
  }

  if (looksLikeHtml(response.body, contentType)) {
    const page = extractHtmlPage(response.body, url);
    if (page.chars < THIN_PAGE_CHARS) throw new Error("The page returned almost no readable text (likely JavaScript-rendered or blocking bots).");
    const { content } = truncateText(page.markdown, maxChars);
    return {
      outcome: {
        url,
        finalUrl: url,
        title: page.title,
        reader: "direct",
        content,
        truncated: content.length < page.markdown.length,
        chars: content.length
      }
    };
  }

  const text = response.body.trim();
  if (!text) throw new Error("The page returned an empty body.");
  const { content } = truncateText(text, maxChars);
  return {
    outcome: {
      url,
      finalUrl: url,
      title: new URL(url).hostname,
      reader: "direct",
      content,
      truncated: content.length < text.length,
      chars: content.length
    }
  };
}

async function exaFetch(deps: FetchDependencies, url: string, maxChars: number): Promise<FetchOutcome> {
  const text = await exaMcpFetch(deps.call, url, maxChars);
  const { content } = truncateText(text.trim(), maxChars);
  const heading = /^#\s+(.+)$/mu.exec(content)?.[1]?.trim();
  return {
    url,
    finalUrl: url,
    title: heading || new URL(url).hostname,
    reader: "exa",
    content,
    truncated: content.length < text.trim().length,
    chars: content.length
  };
}

export function parseJinaOutput(body: string): { title?: string; content: string } {
  const normalized = body.replace(/\r\n/gu, "\n").trim();
  const marker = /^Markdown Content:\s*$/mu.exec(normalized);
  if (!marker) return { content: normalized };
  const head = normalized.slice(0, marker.index);
  const content = normalized.slice(marker.index + marker[0].length).trim();
  const title = /^Title:\s*(.+)$/mu.exec(head)?.[1]?.trim();
  return { title: title || undefined, content };
}

async function jinaFetch(deps: FetchDependencies, url: string, maxChars: number): Promise<FetchOutcome> {
  const key = (await deps.secret(JINA_SECRET_KEY))?.trim();
  const response = await expectOk(
    deps.call,
    {
      url: `https://r.jina.ai/${url}`,
      method: "GET",
      headers: { Accept: "text/plain", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      responseType: "text",
      timeoutMs: 60_000
    },
    "Jina Reader"
  );
  const parsed = parseJinaOutput(response.body);
  if (!parsed.content) throw new Error("Jina Reader returned an empty body.");
  const { content } = truncateText(parsed.content, maxChars);
  return {
    url,
    finalUrl: url,
    title: parsed.title || new URL(url).hostname,
    reader: "jina",
    content,
    truncated: content.length < parsed.content.length,
    chars: content.length
  };
}

/**
 * Reading order: the page itself, then Exa's free reader, then Jina. Every step
 * after the first leaves the machine, which is why `remoteFallback` can be off.
 */
export async function fetchPage(
  deps: FetchDependencies,
  rawUrl: string,
  options: { maxChars?: number; format?: FetchFormat } = {}
): Promise<FetchOutcome> {
  const { url } = parseHttpUrl(rawUrl);
  const privateReason = privateHostReason(url.hostname);
  if (privateReason && !deps.settings.allowPrivateHosts) {
    throw new Error(
      `${url.hostname} is a ${privateReason}. Reading local or intranet addresses is disabled; the user can enable "Allow reading local and private addresses" in Web Access settings.`
    );
  }

  const maxChars = Math.min(Math.max(options.maxChars ?? deps.settings.maxChars, 500), 50_000);
  const target = url.toString();
  const failures: string[] = [];
  const mode = deps.settings.fetchMode;

  if (mode !== "jina") {
    try {
      const direct = await directFetch(deps, target, maxChars);
      return applyFormat(direct.outcome, options.format);
    } catch (error) {
      failures.push(`direct: ${error instanceof Error ? error.message : String(error)}`);
      if (mode === "direct") throw new Error(`Could not read ${target}. ${failures.join("; ")}`);
    }
  }

  if (mode === "jina" || deps.settings.remoteFallback) {
    const steps: Array<{ label: string; run: () => Promise<FetchOutcome> }> = [];
    if (mode === "auto") steps.push({ label: "Exa reader", run: () => exaFetch(deps, target, maxChars) });
    steps.push({ label: "Jina Reader", run: () => jinaFetch(deps, target, maxChars) });

    for (const step of steps) {
      try {
        return applyFormat(await step.run(), options.format);
      } catch (error) {
        failures.push(`${step.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else if (!deps.settings.remoteFallback && mode === "auto") {
    failures.push("remote fallback is turned off");
  }

  throw new Error(`Could not read ${target}. ${failures.join("; ")}`);
}

function applyFormat(outcome: FetchOutcome, format?: FetchFormat): FetchOutcome {
  if (format !== "text") return outcome;
  const content = markdownToPlainText(outcome.content);
  return { ...outcome, content, chars: content.length };
}
