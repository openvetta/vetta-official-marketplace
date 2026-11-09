import { Readability } from "@mozilla/readability";
import { NodeHtmlMarkdown } from "node-html-markdown";

const nhm = new NodeHtmlMarkdown({ maxConsecutiveNewlines: 3, useInlineLinks: false }, {});

const DROP_SELECTORS = "script, style, noscript, template, svg, iframe, canvas, form, nav, footer, header, aside";

export interface ExtractedPage {
  title: string;
  byline?: string;
  siteName?: string;
  markdown: string;
  chars: number;
}

/**
 * Readability works on a real DOM document. In the plugin that is the renderer's
 * DOMParser, which is why the base URL is injected before extraction — otherwise
 * every relative link in the article resolves against about:blank.
 */
export function extractHtmlPage(html: string, url: string): ExtractedPage {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.head) doc.documentElement.insertBefore(doc.createElement("head"), doc.documentElement.firstChild);
  const base = doc.createElement("base");
  base.setAttribute("href", url);
  doc.head.prepend(base);

  const readable = new Readability(doc, { charThreshold: 180, keepClasses: false }).parse();
  const contentHtml = readable?.content?.trim() || fallbackContent(doc);
  const markdown = tidyMarkdown(nhm.translate(contentHtml));
  const siteName = readable?.siteName || metaContent(doc, "og:site_name");
  const byline = readable?.byline || metaContent(doc, "author");

  return {
    title: (readable?.title || doc.title || new URL(url).hostname).trim(),
    byline: byline || undefined,
    siteName: siteName || undefined,
    markdown,
    chars: markdown.length
  };
}

function fallbackContent(doc: Document): string {
  const clone = doc.body?.cloneNode(true) as HTMLElement | undefined;
  if (!clone) return "";
  for (const node of Array.from(clone.querySelectorAll(DROP_SELECTORS))) node.remove();
  return clone.innerHTML;
}

function metaContent(doc: Document, key: string): string {
  const element =
    doc.querySelector(`meta[property="${key}"]`) ??
    doc.querySelector(`meta[name="${key}"]`) ??
    doc.querySelector(`meta[itemprop="${key}"]`);
  return element?.getAttribute("content")?.trim() ?? "";
}

function tidyMarkdown(value: string): string {
  return value
    .replace(/\r\n/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .replace(/^\s+|\s+$/gu, "");
}

/** The `text` output keeps paragraph breaks but drops markup the model cannot use. */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n([\s\S]*?)```/gu, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, "$1 ($2)")
    .replace(/^#{1,6}\s+/gmu, "")
    .replace(/^\s*[-*+]\s+/gmu, "• ")
    .replace(/(\*\*|__)(.*?)\1/gu, "$2")
    .replace(/(?<!\w)[*_]([^*_]+)[*_](?!\w)/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function looksLikeHtml(body: string, contentType: string): boolean {
  if (/text\/html|application\/xhtml\+xml/iu.test(contentType)) return true;
  if (contentType && !/text\/plain|application\/json|application\/xml|text\/xml/iu.test(contentType)) return false;
  return /^\s*<(!doctype\s+html|html|head|body)\b/iu.test(body.slice(0, 400));
}

/** Truncation keeps whole lines so a cut never lands mid-sentence tag. */
export function truncateText(value: string, maxChars: number): { content: string; truncated: boolean } {
  if (value.length <= maxChars) return { content: value, truncated: false };
  const cut = value.slice(0, maxChars);
  const lastBreak = Math.max(cut.lastIndexOf("\n\n"), cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
  const content = `${(lastBreak > maxChars * 0.6 ? cut.slice(0, lastBreak) : cut).trimEnd()}\n\n[… truncated at ${maxChars} characters]`;
  return { content, truncated: true };
}
