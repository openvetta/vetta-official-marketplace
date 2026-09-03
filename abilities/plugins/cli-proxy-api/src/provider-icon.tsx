import type { ReactElement } from "react";
import type { OAuthProviderId } from "./provider-contract";

const TONE_BY_PROVIDER: Record<OAuthProviderId, string> = {
  "gemini-cli": "bg-blue-500/10 text-blue-400 ring-blue-400/20",
  codex: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/20",
  claude: "bg-orange-500/10 text-orange-400 ring-orange-400/20",
  antigravity: "bg-indigo-500/10 text-indigo-400 ring-indigo-400/20",
  kimi: "bg-violet-500/10 text-violet-400 ring-violet-400/20",
  xai: "bg-slate-500/15 text-slate-300 ring-slate-400/20"
};

function ProviderGlyph({ provider }: { provider: OAuthProviderId }): ReactElement {
  if (provider === "gemini-cli") {
    return <path d="M12 2.5c.7 4.9 4.6 8.8 9.5 9.5-4.9.7-8.8 4.6-9.5 9.5-.7-4.9-4.6-8.8-9.5-9.5 4.9-.7 8.8-4.6 9.5-9.5Z" />;
  }
  if (provider === "codex") {
    return <><path d="m7 9 3 3-3 3" /><path d="M13 15h4" /><rect x="3" y="4" width="18" height="16" rx="4" /></>;
  }
  if (provider === "claude") {
    return <><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /><circle cx="12" cy="12" r="2.4" /></>;
  }
  if (provider === "antigravity") {
    return <><circle cx="12" cy="12" r="4.2" /><path d="M3.2 14.7c2.1 2.2 6.6 2.7 11.1.8 4.5-1.8 7.2-5.2 6-7.9" /><circle cx="19.4" cy="7.1" r="1.2" /></>;
  }
  if (provider === "kimi") {
    return <path d="M18.7 15.8A8.1 8.1 0 0 1 8.2 5.3a8.2 8.2 0 1 0 10.5 10.5Z" />;
  }
  return <><path d="M5 5 19 19M19 5 5 19" /><path d="M8.5 3.5c4.8-1.2 9.9 1.7 11.5 6.4" /></>;
}

export function ProviderIcon({ provider, compact = false }: { provider: OAuthProviderId; compact?: boolean }): ReactElement {
  const filled = provider === "gemini-cli" || provider === "kimi";
  return (
    <span
      aria-hidden="true"
      data-provider-icon={provider}
      className={`${compact ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl"} inline-flex shrink-0 items-center justify-center ring-1 ring-inset ${TONE_BY_PROVIDER[provider]}`}
    >
      <svg className={compact ? "h-4 w-4" : "h-5 w-5"} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ProviderGlyph provider={provider} />
      </svg>
    </span>
  );
}
