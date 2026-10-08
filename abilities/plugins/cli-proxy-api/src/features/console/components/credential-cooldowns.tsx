import { useTranslation } from "@vetta-org/plugin-sdk";
import type { CredentialCooldown } from "../../../domain/credential-capabilities";
import { formatMoment } from "../../../domain/console-format";

export function CredentialCooldowns({ cooldowns }: { cooldowns: readonly CredentialCooldown[] | undefined }) {
  const { t } = useTranslation();
  if (!cooldowns?.length) return null;
  return (
    <details className="mx-3.5 mb-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px]">
      <summary className="cursor-pointer text-amber-500">{t("console.cooldowns", { count: cooldowns.length })}</summary>
      <ul className="mt-2 space-y-2">
        {cooldowns.map((entry, index) => (
          <li key={`${entry.scope}/${entry.model ?? index}`}>
            <p className="break-all font-medium text-foreground">{entry.scope === "model" ? entry.model : t("console.credentialCooldown")}</p>
            <p className="text-muted-foreground">{t("console.cooldownUntil", { time: formatMoment(entry.retryAt) ?? entry.retryAt })}</p>
            {entry.httpStatus ? <p className="text-muted-foreground">HTTP {entry.httpStatus}</p> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
