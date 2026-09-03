import type { ReactElement } from "react";
import type { OAuthProviderId } from "./provider-contract";
// Official product marks only: Google Developers Gemini 2025 icon, OpenAI Blossom,
// Anthropic starburst, antigravity.google apple-touch icon, Moonshot branding app icon,
// and the grok.com favicon for xAI.
import geminiCliIcon from "../assets/providers/gemini-cli.png";
import codexIcon from "../assets/providers/codex.png";
import claudeIcon from "../assets/providers/claude.png";
import antigravityIcon from "../assets/providers/antigravity.png";
import kimiIcon from "../assets/providers/kimi.png";
import xaiIcon from "../assets/providers/xai.png";

const ICON_BY_PROVIDER: Record<OAuthProviderId, string> = {
  "gemini-cli": geminiCliIcon,
  codex: codexIcon,
  claude: claudeIcon,
  antigravity: antigravityIcon,
  kimi: kimiIcon,
  xai: xaiIcon
};

const FILLS_TILE: Record<OAuthProviderId, boolean> = {
  "gemini-cli": false,
  codex: false,
  claude: false,
  antigravity: true,
  kimi: true,
  xai: true
};

export function ProviderIcon({ provider, compact = false }: { provider: OAuthProviderId; compact?: boolean }): ReactElement {
  const fillsTile = FILLS_TILE[provider];
  return (
    <span
      aria-hidden="true"
      data-provider-icon={provider}
      className={`${compact ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl"} inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-border/40`}
    >
      <img
        src={ICON_BY_PROVIDER[provider]}
        alt=""
        draggable={false}
        className={fillsTile ? "h-full w-full object-cover" : `${compact ? "h-5 w-5" : "h-6 w-6"} object-contain`}
      />
    </span>
  );
}
