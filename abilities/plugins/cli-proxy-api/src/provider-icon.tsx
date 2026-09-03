import type { ReactElement } from "react";
import type { OAuthProviderId } from "./provider-contract";
// Vector marks are vendored from the pinned Lobe Icons static package. Keeping
// them inside the plugin avoids runtime network requests and raster scaling.
import geminiCliIcon from "../assets/providers/gemini-cli.svg";
import codexIcon from "../assets/providers/codex.svg";
import claudeIcon from "../assets/providers/claude.svg";
import antigravityIcon from "../assets/providers/antigravity.svg";
import kimiIcon from "../assets/providers/kimi.svg";
import xaiIcon from "../assets/providers/xai.svg";

const ICON_BY_PROVIDER: Record<OAuthProviderId, string> = {
  "gemini-cli": geminiCliIcon,
  codex: codexIcon,
  claude: claudeIcon,
  antigravity: antigravityIcon,
  kimi: kimiIcon,
  xai: xaiIcon
};

const ICON_SIZE: Record<OAuthProviderId, { compact: string; regular: string }> = {
  "gemini-cli": { compact: "h-5 w-5", regular: "h-7 w-7" },
  codex: { compact: "h-[18px] w-[18px]", regular: "h-6 w-6" },
  claude: { compact: "h-5 w-5", regular: "h-7 w-7" },
  antigravity: { compact: "h-5 w-5", regular: "h-6 w-6" },
  kimi: { compact: "h-5 w-5", regular: "h-6 w-6" },
  xai: { compact: "h-5 w-5", regular: "h-6 w-6" }
};

export function ProviderIcon({ provider, compact = false }: { provider: OAuthProviderId; compact?: boolean }): ReactElement {
  const imageSize = compact ? ICON_SIZE[provider].compact : ICON_SIZE[provider].regular;
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
        className={`${imageSize} object-contain`}
      />
    </span>
  );
}
