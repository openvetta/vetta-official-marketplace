import { type AccountQuota } from "../proxy-client";

/** Providers park a credential with a JSON error body; only the sentence is useful. */
export function readableStatus(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const trimmed = message.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const error = parsed && typeof parsed === "object" ? (parsed as { error?: unknown }).error : undefined;
    const text = error && typeof error === "object" ? (error as { message?: unknown }).message : undefined;
    return typeof text === "string" && text.trim() ? text.trim() : undefined;
  } catch {
    return trimmed;
  }
}

/**
 * Combines what the provider just said with what the gateway had already seen.
 *
 * The live probe carries the limits and the plan; the gateway's own record
 * carries things the usage endpoint never returns — the subscription date it
 * read from the identity token, and when a parked credential is due back.
 */
export function mergeQuota(observed: AccountQuota | undefined, probed: AccountQuota | undefined): AccountQuota | undefined {
  if (!probed) return observed;
  if (!observed) return probed;
  return {
    ...probed,
    ...(probed.plan ?? observed.plan ? { plan: probed.plan ?? observed.plan } : {}),
    ...(observed.subscriptionUntil ? { subscriptionUntil: observed.subscriptionUntil } : {}),
    ...(observed.nextRetryAfter ? { nextRetryAfter: observed.nextRetryAfter } : {})
  };
}
