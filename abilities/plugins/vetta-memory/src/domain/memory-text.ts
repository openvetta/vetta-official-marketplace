import { MAX_MEMORY_CONTENT } from "./memory-types";

/** Collapses whitespace and trims; the canonical single-line form of a memory. */
export function cleanContent(raw: string): string {
    return raw.replace(/\s+/g, " ").trim().slice(0, MAX_MEMORY_CONTENT);
}

/** Keeps line breaks (daily logs, summaries) but trims noise and caps the length. */
export function cleanBlock(raw: string, max: number): string {
    return raw
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max);
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
const TAG = /#[\p{L}\p{N}_-]+/gu;
const WIKI_LINK = /\[\[([^\]\n]{1,60})\]\]/g;

/** `#tags` and `[[wiki-links]]` written inside a memory; they are content conventions, as in plain-markdown memory files. */
export function extractLabels(text: string): { tags: string[]; links: string[] } {
    const tags = [...new Set((text.match(TAG) ?? []).map((tag) => tag.toLowerCase()))];
    const links = [...new Set([...text.matchAll(WIKI_LINK)].map((match) => match[1].trim().toLowerCase()))];
    return { tags, links };
}

/**
 * Tokens for matching: latin words, `#tags`, `[[links]]` and CJK character
 * bigrams (plus single characters so one-character CJK queries still match).
 */
export function tokenize(text: string): string[] {
    const tokens: string[] = [];
    const lowered = text.toLowerCase();
    const { tags, links } = extractLabels(lowered);
    tokens.push(...tags, ...links.map((link) => `[[${link}]]`));
    for (const word of lowered.match(/[a-z0-9_]{2,}/g) ?? []) tokens.push(word);
    const cjk = [...lowered].filter((ch) => CJK.test(ch));
    for (let i = 0; i < cjk.length; i++) {
        tokens.push(cjk[i]);
        if (i + 1 < cjk.length) tokens.push(cjk[i] + cjk[i + 1]);
    }
    return tokens;
}

/** Jaccard similarity of token sets; 1 = identical vocabulary. */
export function similarity(a: string, b: string): number {
    const left = new Set(tokenize(a));
    const right = new Set(tokenize(b));
    if (left.size === 0 || right.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
    let shared = 0;
    for (const token of left) if (right.has(token)) shared++;
    return shared / (left.size + right.size - shared);
}

const SENSITIVE_PATTERNS = [
    /\bsk-[a-z0-9_-]{16,}/i,
    /\b(?:ghp|gho|github_pat)_[a-z0-9_]{20,}/i,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bbearer\s+[a-z0-9._-]{16,}/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{6,}/i,
    /(?:密码|口令|密钥)\s*[:：=是为]\s*\S{4,}/,
];

/** Credentials must never be persisted as memories. */
export function looksSensitive(text: string): boolean {
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/** Keeps the last `max` characters, cutting at a line boundary when possible. */
export function tailText(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(text.length - max);
    const newline = cut.indexOf("\n");
    return newline >= 0 && newline < cut.length - 1 ? cut.slice(newline + 1) : cut;
}

/** Local `YYYY-MM-DD` key for a timestamp. */
export function dateKey(timestamp: number): string {
    const d = new Date(timestamp);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function clockTime(timestamp: number): string {
    const d = new Date(timestamp);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isDateKey(value: unknown): value is string {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function projectName(projectKey: string | null): string {
    if (!projectKey) return "";
    const parts = projectKey.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? projectKey;
}

export function newId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
