import { useTranslation } from "@vetta-org/plugin-sdk";
import { type QuotaWindow } from "../../../proxy-client";

/** Names a limit window by its span, because that is how providers describe them. */
export function useWindowLabel(): (minutes: number | undefined) => string {
  const { t } = useTranslation();
  return (minutes) => {
    if (minutes === undefined) return t("console.windowUnknown");
    if (minutes === 10080) return t("console.windowWeekly");
    if (minutes === 1440) return t("console.windowDaily");
    if (minutes % 60 === 0) return t("console.windowHours", { count: minutes / 60 });
    return t("console.windowMinutes", { count: minutes });
  };
}

/** "3 小时后" reads better than a timestamp for something that resets on a clock. */
export function useCountdown(): (window: QuotaWindow) => string | undefined {
  const { t } = useTranslation();
  return (window) => {
    const seconds = window.resetInSeconds ?? (window.resetAt
      ? Math.round((new Date(window.resetAt).getTime() - Date.now()) / 1000)
      : undefined);
    if (seconds === undefined || !Number.isFinite(seconds)) return undefined;
    if (seconds <= 0) return t("console.resetNow");
    if (seconds >= 86_400) return t("console.resetInDays", { count: Math.round(seconds / 86_400) });
    if (seconds >= 3600) return t("console.resetInHours", { count: Math.round(seconds / 3600) });
    return t("console.resetInMinutes", { count: Math.max(1, Math.round(seconds / 60)) });
  };
}
