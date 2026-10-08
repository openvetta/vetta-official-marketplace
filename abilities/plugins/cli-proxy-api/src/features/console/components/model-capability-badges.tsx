import { useTranslation } from "@vetta-org/plugin-sdk";
import type { ModelMetadata } from "../../../proxy-client";

/** Non-chat modalities and search describe CPA; they do not enable host tools. */
export function ModelCapabilityBadges({ model }: { model: ModelMetadata }) {
  const { t } = useTranslation();
  return (
    <span className="flex shrink-0 flex-wrap gap-1" title={t("console.upstreamCapabilities")}>
      {(model.inputModalities ?? model.input ?? []).filter((kind) => kind !== "text").map((kind) => (
        <span key={kind} className="rounded bg-muted/60 px-1 text-[10px] text-muted-foreground">{t(`console.inputModality.${kind}`)}</span>
      ))}
      {model.nativeWebSearch ? <span className="rounded bg-muted/60 px-1 text-[10px] text-muted-foreground">{t("console.nativeSearch")}</span> : null}
    </span>
  );
}
