import { z } from "zod";

const cooldownSchema = z.object({
  scope: z.enum(["credential", "model"]),
  model_key: z.string().optional(),
  reason: z.string(),
  retry_at: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  remaining_seconds: z.number().finite().nonnegative(),
  http_status: z.number().int().optional(),
});

export type CredentialCooldown = {
  scope: "credential" | "model";
  model?: string;
  reason: string;
  retryAt: string;
  remainingSeconds: number;
  httpStatus?: number;
};

/** Undefined means CPA has no local snapshot (for example a remote Home account). */
export function readCooldowns(value: unknown): CredentialCooldown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const parsed = cooldownSchema.safeParse(item);
    if (!parsed.success) return [];
    const entry = parsed.data;
    return [{ scope: entry.scope, reason: entry.reason, retryAt: entry.retry_at,
      remainingSeconds: entry.remaining_seconds,
      ...(entry.model_key ? { model: entry.model_key } : {}),
      ...(entry.http_status === undefined ? {} : { httpStatus: entry.http_status }),
    }];
  });
}
