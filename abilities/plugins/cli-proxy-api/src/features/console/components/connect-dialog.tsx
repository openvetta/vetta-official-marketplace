import { useTranslation } from "@vetta-org/plugin-sdk";
import { type ReactElement } from "react";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "../../../provider-contract";
import { ProviderIcon } from "../../../shared/components/provider-icon";
import { Dialog } from "../../../shared/components/dialog";

/** The provider picker; authorizing is a deliberate act, not a permanent toolbar. */
export function ConnectDialog({ onClose, onPick, disabled }: {
  onClose: () => void;
  onPick: (provider: OAuthProviderId) => void;
  disabled: boolean;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <Dialog title={t("console.addAccount")} description={t("setup.oauthDescription")} onClose={onClose}>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {OAUTH_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(provider.id)}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3 text-left transition-colors hover:border-border hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ProviderIcon provider={provider.id} compact />
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">{t(`provider.${provider.id}`)}</span>
              <span className="block text-[11px] text-muted-foreground">{provider.deviceFlow ? t("setup.deviceFlow") : t("setup.browserFlow")}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
