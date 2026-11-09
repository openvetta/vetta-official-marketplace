import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeBaseUrl, normalizeSettings } from "../domain/settings";

describe("settings", () => {
  it("falls back field by field instead of discarding the file", () => {
    const settings = normalizeSettings({ searchProvider: "unknown", resultCount: 99, fetchMode: "jina", maxChars: 12 });
    expect(settings.searchProvider).toBe(DEFAULT_SETTINGS.searchProvider);
    expect(settings.resultCount).toBe(DEFAULT_SETTINGS.resultCount);
    expect(settings.fetchMode).toBe("jina");
    expect(settings.maxChars).toBe(DEFAULT_SETTINGS.maxChars);
  });

  it("keeps a valid configuration", () => {
    const settings = normalizeSettings({
      searchProvider: "brave",
      resultCount: 3,
      fetchMode: "direct",
      maxChars: 20000,
      searxngUrl: "https://search.example.com/",
      allowPrivateHosts: true,
      remoteFallback: false
    });
    expect(settings).toMatchObject({
      searchProvider: "brave",
      resultCount: 3,
      fetchMode: "direct",
      maxChars: 20000,
      searxngUrl: "https://search.example.com",
      allowPrivateHosts: true,
      remoteFallback: false
    });
  });

  it("normalizes instance addresses and rejects non-http values", () => {
    expect(normalizeBaseUrl(" https://search.example.com/base/ ")).toBe("https://search.example.com/base");
    expect(normalizeBaseUrl("ftp://search.example.com")).toBe("");
    expect(normalizeBaseUrl("not a url")).toBe("");
  });
});
