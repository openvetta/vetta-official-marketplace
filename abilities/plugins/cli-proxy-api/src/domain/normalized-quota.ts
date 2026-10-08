import { z } from "zod";
import type { AccountQuota, QuotaGroup } from "../proxy-client";

const bucketSchema = z.object({
  window: z.string().optional(),
  remainingFraction: z.number().finite().optional(),
  remaining_fraction: z.number().finite().optional(),
  resetTime: z.string().optional(),
  reset_time: z.string().optional(),
  description: z.string().optional(),
}).refine((entry) => entry.remainingFraction !== undefined || entry.remaining_fraction !== undefined);
const metricSchema = z.object({
  key: z.string().min(1), label: z.string().min(1), value: z.number().finite(),
  unit: z.string().optional(), format: z.enum(["number", "currency"]).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/u).optional(),
});
const quotaSchema = z.object({
  subscription: z.object({ plan: z.string().optional(), tierName: z.string().optional(), tier_name: z.string().optional() }).optional(),
  summary: z.array(z.unknown()).optional(),
  groups: z.array(z.object({ displayName: z.string().optional(), display_name: z.string().optional(), buckets: z.array(z.unknown()).optional() })).optional(),
});

export type QuotaSummaryMetric = z.infer<typeof metricSchema>;

/** CPA's normalized quota contract; no guessed balance or window on malformed data. */
export function readNormalizedQuota(value: unknown): AccountQuota | undefined {
  const parsed = quotaSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const data = parsed.data;
  const groups: QuotaGroup[] = (data.groups ?? []).flatMap((group) => {
    const windows = (group.buckets ?? []).flatMap((raw) => {
      const bucket = bucketSchema.safeParse(raw);
      if (!bucket.success) return [];
      const entry = bucket.data;
      const fraction = entry.remainingFraction ?? entry.remaining_fraction!;
      const resetAt = entry.resetTime ?? entry.reset_time;
      return [{ remainingPercent: Math.max(0, Math.min(100, fraction * 100)),
        ...(entry.window ? { label: entry.window } : {}),
        ...(resetAt && Number.isFinite(Date.parse(resetAt)) ? { resetAt } : {}),
      }];
    });
    return windows.length ? [{ name: group.displayName ?? group.display_name, windows }] : [];
  });
  const summary = (data.summary ?? []).flatMap((raw) => {
    const metric = metricSchema.safeParse(raw);
    return metric.success ? [metric.data] : [];
  });
  const plan = data.subscription?.plan ?? data.subscription?.tierName ?? data.subscription?.tier_name;
  if (!groups.length && !summary.length && !plan) return undefined;
  return { windows: [], ...(groups.length ? { groups } : {}), ...(summary.length ? { summary } : {}), ...(plan ? { plan } : {}) };
}
