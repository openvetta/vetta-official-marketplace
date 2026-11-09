import { describe, expect, it } from "vitest";
import { extractHtmlPage, looksLikeHtml, markdownToPlainText, truncateText } from "../domain/html-extract";

const ARTICLE = `<!doctype html>
<html>
  <head>
    <title>Fallback title</title>
    <meta property="og:site_name" content="Example News" />
  </head>
  <body>
    <nav><a href="/home">Home</a></nav>
    <article>
      <h1>Quarterly numbers</h1>
      <p>Revenue grew to 42 million in the second quarter, according to the report published today.</p>
      <p>The full breakdown is in the <a href="/report">report</a>, which we summarise below with the numbers that matter to most readers.</p>
      <ul><li>Revenue: 42M</li><li>Costs: 21M</li></ul>
      <pre><code>const margin = 0.5;</code></pre>
      <p>Analysts expected 39 million, so the result beat guidance by roughly eight percent, and the company kept its full-year outlook unchanged.</p>
      <p>More context follows in the paragraphs below so that the readability threshold is met and the extractor keeps the article instead of the page chrome.</p>
    </article>
    <footer>All rights reserved</footer>
    <script>window.tracker = 1;</script>
  </body>
</html>`;

describe("html extraction", () => {
  it("keeps article content and resolves relative links", () => {
    const page = extractHtmlPage(ARTICLE, "https://news.example.com/story");
    expect(page.title).toBe("Fallback title");
    expect(page.siteName).toBe("Example News");
    expect(page.markdown).toContain("Revenue grew to 42 million");
    expect(page.markdown).toContain("https://news.example.com/report");
    expect(page.markdown).not.toContain("All rights reserved");
    expect(page.markdown).not.toContain("window.tracker");
  });

  it("recognises html from content type or from the body", () => {
    expect(looksLikeHtml("", "text/html; charset=utf-8")).toBe(true);
    expect(looksLikeHtml("<!doctype html><body>x</body>", "text/plain")).toBe(true);
    expect(looksLikeHtml('{"ok":true}', "application/json")).toBe(false);
  });

  it("flattens markdown without losing the links", () => {
    const text = markdownToPlainText("# Title\n\n- [Report](https://example.com/r)\n\n**bold** `code`");
    expect(text).toContain("Title");
    expect(text).toContain("Report (https://example.com/r)");
    expect(text).toContain("bold");
    expect(text).toContain("code");
  });

  it("truncates on a line boundary", () => {
    const source = Array.from({ length: 50 }, (_, index) => `Line ${index} with some text.`).join("\n");
    const { content, truncated } = truncateText(source, 100);
    expect(truncated).toBe(true);
    expect(content).toContain("truncated");
    expect(content.split("\n")[0]).toBe("Line 0 with some text.");
  });
});
