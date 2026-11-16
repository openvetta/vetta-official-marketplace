/**
 * Builds the srcdoc for model-written HTML. The document runs in an iframe whose sandbox
 * omits `allow-same-origin`, so it gets an opaque origin: it cannot read the host DOM,
 * storage or plugin APIs. The only way out is `postMessage`, which the host treats as
 * untrusted (resize hints and prompts that the user must confirm).
 */
import baseCss from "./sandbox/vg-base.css?raw";
import enhanceJs from "./sandbox/vg-enhance.js?raw";

export const BRIDGE_SOURCE = "vetta-generative-ui";

export interface HostPalette {
    background: string;
    foreground: string;
    muted: string;
    border: string;
    primary: string;
    primaryForeground: string;
    fontFamily: string;
    colorScheme: "light" | "dark";
}

export const FALLBACK_PALETTE: HostPalette = {
    background: "#ffffff",
    foreground: "#18181b",
    muted: "#71717a",
    border: "#e4e4e7",
    primary: "#18181b",
    primaryForeground: "#fafafa",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    colorScheme: "light",
};

// Network is limited to loading scripts, styles, fonts and images (e.g. from a CDN);
// fetch/XHR/WebSocket and form submission are blocked so the view cannot exfiltrate data.
const CSP = [
    "default-src 'none'",
    "script-src 'unsafe-inline' https:",
    "style-src 'unsafe-inline' https:",
    "img-src data: blob: https:",
    "font-src data: https:",
    "media-src data: blob: https:",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
].join("; ");

const sanitizeCss = (value: string) => value.replace(/[<>;{}]/gu, "");

function rootVariables(palette: HostPalette): string {
    const p = Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, sanitizeCss(String(value))])) as unknown as HostPalette;
    return `:root{color-scheme:${p.colorScheme};--vg-bg:${p.background};--vg-fg:${p.foreground};--vg-muted:${p.muted};--vg-border:${p.border};--vg-primary:${p.primary};--vg-primary-fg:${p.primaryForeground};--vg-radius:10px;--vg-font:${p.fontFamily}}`;
}

/** Optional vendored libraries, loaded on demand and injected inline (offline, CSP-safe). */
export const SANDBOX_LIBS = ["tailwind", "chartjs"] as const;
export type SandboxLib = (typeof SANDBOX_LIBS)[number];
export type SandboxLibSources = Partial<Record<SandboxLib, string>>;

/** Tailwind without preflight, wired to the host theme so `bg-primary`, `text-muted-foreground` etc. match Vetta. */
const TAILWIND_THEME = `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
@theme inline {
  --color-background: var(--vg-bg);
  --color-foreground: var(--vg-fg);
  --color-muted-foreground: var(--vg-muted);
  --color-muted: color-mix(in srgb, var(--vg-fg) 6%, transparent);
  --color-card: color-mix(in srgb, var(--vg-fg) 5%, transparent);
  --color-border: color-mix(in srgb, var(--vg-fg) 12%, transparent);
  --color-primary: var(--vg-primary);
  --color-primary-foreground: var(--vg-primary-fg);
  --font-sans: var(--vg-font);
  --radius-lg: var(--vg-radius);
  --radius-xl: calc(var(--vg-radius) + 2px);
  --radius-2xl: calc(var(--vg-radius) + 6px);
}`;

const CHART_DEFAULTS = `(function(){if(!window.Chart)return;var s=getComputedStyle(document.documentElement);Chart.defaults.color=s.getPropertyValue("--vg-muted").trim()||"#888";Chart.defaults.borderColor="rgba(127,127,127,.18)";Chart.defaults.font.family=s.getPropertyValue("--vg-font").trim()||"system-ui";})();`;

const inlineScript = (source: string) => `<script>${source.replace(/<\/script/giu, "<\\/script")}</script>`;

/** Theme values the host may push after load, mapped to the CSS variables the view uses. */
export const THEME_VARIABLES: Record<Exclude<keyof HostPalette, "colorScheme">, string> = {
    background: "--vg-bg",
    foreground: "--vg-fg",
    muted: "--vg-muted",
    border: "--vg-border",
    primary: "--vg-primary",
    primaryForeground: "--vg-primary-fg",
    fontFamily: "--vg-font",
};

const BRIDGE_SCRIPT = `(function(){var S=${JSON.stringify(BRIDGE_SOURCE)},V=${JSON.stringify(THEME_VARIABLES)};function post(m){m.source=S;parent.postMessage(m,"*")}
window.vetta={palette:["#6366f1","#14b8a6","#f59e0b","#ec4899","#0ea5e9","#84cc16","#a855f7","#f97316"],sendPrompt:function(t){if(typeof t==="string"&&t.trim())post({kind:"prompt",text:t.slice(0,4000)})}};
function report(){post({kind:"resize",height:Math.ceil(Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0))})}
window.addEventListener("message",function(e){var d=e.data;if(e.source!==parent||!d||d.source!==S||d.kind!=="theme"||!d.palette)return;var r=document.documentElement.style;for(var k in V){var v=d.palette[k];if(typeof v==="string")r.setProperty(V[k],v.replace(/[<>;{}]/g,""))}if(d.palette.colorScheme==="dark"||d.palette.colorScheme==="light")r.colorScheme=d.palette.colorScheme});
function edge(){var e=document.scrollingElement||document.documentElement,t=e.scrollTop,m=e.scrollHeight-e.clientHeight;post({kind:"scroll",top:t<=1,bottom:m-t<=1})}
window.addEventListener("scroll",edge,{passive:true});
if(typeof ResizeObserver==="function")new ResizeObserver(report).observe(document.documentElement);
if(typeof ResizeObserver==="function")new ResizeObserver(edge).observe(document.documentElement);
window.addEventListener("load",report);document.addEventListener("DOMContentLoaded",report);})();`;

export function themeMessage(palette: HostPalette) {
    return { source: BRIDGE_SOURCE, kind: "theme", palette };
}

export function buildHtmlDocument(html: string, palette: HostPalette, libs: SandboxLibSources = {}): string {
    const parts = [
        `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">`,
        `<style>${rootVariables(palette)}</style>`,
        `<style>${baseCss}</style>`,
        libs.tailwind ? `<style type="text/tailwindcss">${TAILWIND_THEME}</style>` : "",
        `<script>${BRIDGE_SCRIPT}</script>`,
        `<script>${enhanceJs}</script>`,
        libs.tailwind ? inlineScript(libs.tailwind) : "",
        libs.chartjs ? `${inlineScript(libs.chartjs)}<script>${CHART_DEFAULTS}</script>` : "",
    ];
    const head = parts.join("");
    if (/<head[^>]*>/iu.test(html)) return html.replace(/<head[^>]*>/iu, (match) => `${match}${head}`);
    if (/<html[^>]*>/iu.test(html)) return html.replace(/<html[^>]*>/iu, (match) => `${match}<head>${head}</head>`);
    return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}

export type BridgeMessage = { kind: "resize"; height: number } | { kind: "prompt"; text: string } | { kind: "scroll"; top: boolean; bottom: boolean };

/** Narrows an untrusted postMessage payload from the sandboxed view. */
export function parseBridgeMessage(data: unknown): BridgeMessage | null {
    if (!data || typeof data !== "object") return null;
    const message = data as Record<string, unknown>;
    if (message.source !== BRIDGE_SOURCE) return null;
    if (message.kind === "resize" && typeof message.height === "number" && Number.isFinite(message.height)) {
        return { kind: "resize", height: message.height };
    }
    if (message.kind === "scroll" && typeof message.top === "boolean" && typeof message.bottom === "boolean") {
        return { kind: "scroll", top: message.top, bottom: message.bottom };
    }
    if (message.kind === "prompt" && typeof message.text === "string" && message.text.trim()) {
        return { kind: "prompt", text: message.text.slice(0, 4000) };
    }
    return null;
}
