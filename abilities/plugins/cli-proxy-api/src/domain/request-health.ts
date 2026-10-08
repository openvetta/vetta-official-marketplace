import { type ProxyAccount, type UsageBucket } from "../proxy-client";

/** Windows the gateway keeps per credential; a fixed axis keeps every strip aligned. */
export const HEALTH_WINDOWS = 20;

/** Pads to a fixed axis so a quiet credential still reads as a timeline, not a stub. */
export function paddedBuckets(buckets: UsageBucket[]): UsageBucket[] {
  const tail = buckets.slice(-HEALTH_WINDOWS);
  const padding = Array.from({ length: Math.max(0, HEALTH_WINDOWS - tail.length) }, () => ({ time: "", success: 0, failed: 0 }));
  return [...padding, ...tail];
}

/** Adds credential timelines position by position; upstream aligns them by index. */
export function mergeBuckets(accounts: ProxyAccount[]): UsageBucket[] {
  const merged: UsageBucket[] = [];
  for (const account of accounts) {
    paddedBuckets(account.recentRequests).forEach((bucket, index) => {
      const current = merged[index];
      if (!current) {
        merged[index] = { ...bucket };
        return;
      }
      current.success += bucket.success;
      current.failed += bucket.failed;
      if (!current.time) current.time = bucket.time;
    });
  }
  return merged;
}

export function successRate(success: number, failed: number): number | null {
  const total = success + failed;
  return total === 0 ? null : Math.round((success / total) * 1000) / 10;
}
