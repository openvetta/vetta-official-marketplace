import { useTranslation } from "@vetta-org/plugin-sdk";
import { type ReactElement } from "react";
import { type OAuthProviderId } from "../../../provider-contract";
import { ProviderIcon } from "../../../shared/components/provider-icon";
import { ActionIcon } from "../../../shared/components/action-icon";
import { Button } from "../../../shared/components/button";
import { ProviderTag } from "../../../shared/components/provider-tag";
import { Spin } from "../../../shared/components/spin";
import { Toggle } from "../../../shared/components/toggle";
import { type AccountQuota, type ProxyAccount } from "../../../proxy-client";
import { formatBytes } from "../../../domain/console-format";
import { formatMoment } from "../../../domain/console-format";
import { successRate } from "../../../domain/request-health";
import { HealthStrip } from "./health-strip";
import { readableStatus } from "../../../domain/account-presentation";
import { mergeQuota } from "../../../domain/account-presentation";
import { QuotaPanel } from "./quota-panel";
import { CredentialCooldowns } from "./credential-cooldowns";

/** One credential, laid out as the CLIProxyAPI panel lays it out. */
export function AccountCard({
  account, provider, pending, confirming, removing, disabled, quota, quotaLoading, quotaError,
  onModels, onReset, onToggle, onAskRemove, onCancelRemove, onRemove, onRefreshQuota, onRefreshCredential
}: {
  account: ProxyAccount;
  provider: OAuthProviderId | undefined;
  quota: AccountQuota | undefined;
  quotaLoading: boolean;
  quotaError: string | undefined;
  onRefreshQuota: () => void;
  onRefreshCredential: () => void;
  pending: boolean;
  confirming: boolean;
  removing: boolean;
  disabled: boolean;
  onModels: () => void;
  onReset: () => void;
  onToggle: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const rate = successRate(account.success, account.failed);
  const meta = [formatBytes(account.size), formatMoment(account.modifiedAt ?? account.lastRefresh)].filter(Boolean).join(" · ");
  const status = account.statusMessage && account.statusMessage !== "ok" ? readableStatus(account.statusMessage) : undefined;
  const stateTone = account.disabled
    ? "bg-muted/70 text-muted-foreground"
    : account.active ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400";

  return (
    <article className="flex flex-col rounded-xl border border-border/50 bg-card/30 transition-colors hover:border-border/80">
      <header className="flex items-start gap-2.5 p-3.5 pb-2.5">
        {provider ? <ProviderIcon provider={provider} compact /> : (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold uppercase text-muted-foreground" aria-hidden="true">
            {account.provider.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ProviderTag>{provider ? t(`provider.short.${provider}`) : account.provider}</ProviderTag>
            <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${stateTone}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {t(account.disabled ? "console.disabled" : account.active ? "console.enabled" : "setup.accountUnavailable")}
            </span>
          </div>
          <p className="mt-1.5 truncate text-sm font-medium text-foreground" title={account.displayName}>{account.displayName}</p>
          {account.deleteName && account.deleteName !== account.displayName ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={account.deleteName}>{account.deleteName}</p>
          ) : null}
        </div>
      </header>

      <div className="px-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{t("console.healthStatus")}</span>
          <span className="flex items-baseline gap-2.5 text-[11px] tabular-nums">
            <span className={account.success > 0 ? "text-emerald-400" : "text-muted-foreground"}>{t("console.successCount", { count: account.success })}</span>
            <span className={account.failed > 0 ? "text-destructive" : "text-muted-foreground"}>{t("console.failedCount", { count: account.failed })}</span>
          </span>
        </div>
        <HealthStrip buckets={account.recentRequests} />
        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground">{meta}</p>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">{rate === null ? "—" : `${rate}%`}</span>
        </div>
        {status ? <p className="mt-1 truncate text-[11px] text-amber-400" title={status}>{status}</p> : null}
      </div>

      <QuotaPanel account={account} quota={mergeQuota(account.quota, quota)} loading={quotaLoading} error={quotaError} onRefresh={onRefreshQuota} />
      <CredentialCooldowns cooldowns={account.cooldowns} />

      <footer className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/40 px-3.5 py-2.5">
        {confirming ? (
          <>
            <p className="w-full text-[11px] text-destructive">{t("setup.removeAccountConfirm", { account: account.displayName })}</p>
            <Button className="border-destructive/40 text-destructive hover:bg-destructive/10" disabled={removing} onClick={onRemove}>
              {removing ? <Spin /> : <ActionIcon name="remove" />}{t("setup.confirmRemove")}
            </Button>
            <Button className="border-transparent bg-transparent" disabled={removing} onClick={onCancelRemove}>{t("setup.cancel")}</Button>
          </>
        ) : (
          <>
            <Button onClick={onModels}><ActionIcon name="models" />{t("console.models")}</Button>
            <Button aria-label={`${t("console.refreshCredential")} ${account.displayName}`} title={t("console.refreshCredential")}
              disabled={disabled || !account.authIndex || !account.deleteName} onClick={onRefreshCredential}>
              {pending ? <Spin /> : <ActionIcon name="sync" />}{t("console.refreshCredential")}
            </Button>
            <Button aria-label={`${t("console.resetQuota")} ${account.displayName}`} title={t("console.resetQuota")} disabled={disabled || !account.authIndex} onClick={onReset}>
              {pending ? <Spin /> : <ActionIcon name="reset" />}
            </Button>
            {account.removable ? (
              <Button className="text-destructive hover:bg-destructive/10" aria-label={`${t("setup.removeAccount")} ${account.displayName}`} title={t("setup.removeAccount")} disabled={disabled} onClick={onAskRemove}>
                <ActionIcon name="remove" />
              </Button>
            ) : null}
            <span className="ml-auto flex items-center">
              <Toggle
                checked={!account.disabled}
                disabled={disabled}
                label={`${t(account.disabled ? "console.enable" : "console.disable")} ${account.displayName}`}
                onChange={onToggle}
              />
            </span>
          </>
        )}
      </footer>
    </article>
  );
}
