

/**
 * Token limits, in the units their vendor quotes them in.
 *
 * Model context is published in both conventions — 200000 is "200K" and 65536
 * is "64K" — so a single divisor always misreads one of them. Whichever base
 * divides evenly is the one the number was written in.
 */
export function formatTokens(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value >= 1_000_000) {
    return value % 1_048_576 === 0 ? `${value / 1_048_576}M` : `${Math.round((value / 1_000_000) * 100) / 100}M`;
  }
  if (value % 1000 === 0) return `${value / 1000}K`;
  if (value % 1024 === 0) return `${value / 1024}K`;
  if (value >= 1000) return `${Math.round((value / 1000) * 10) / 10}K`;
  return `${value}`;
}

export function formatBytes(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

export function formatDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toLocaleDateString();
}

export function formatMoment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toLocaleString();
}
