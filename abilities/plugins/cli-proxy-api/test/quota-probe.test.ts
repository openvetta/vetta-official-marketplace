import { describe, expect, it, vi } from "vitest";
import { hasQuotaProbe, probeAccountQuota } from "../src/quota-probe";
import type { ProxyAccount } from "../src/proxy-client";

function account(over: Partial<ProxyAccount> = {}): ProxyAccount {
  return {
    key: "k", provider: "codex", displayName: "user@example.com", active: true, disabled: false,
    removable: true, authIndex: "idx-1", success: 0, failed: 0, recentRequests: [], ...over
  };
}

/** Verbatim shapes from the live providers, trimmed to what the panel reads. */
const CODEX_USAGE = {
  plan_type: "plus",
  rate_limit: {
    primary_window: { used_percent: 100, limit_window_seconds: 18000, reset_after_seconds: 11414, reset_at: 1788516790 },
    secondary_window: { used_percent: 32, limit_window_seconds: 604800, reset_at: 1789019386 }
  },
  credits: { has_credits: false, unlimited: false, balance: "0" },
  rate_limit_reset_credits: { available_count: 2 }
};
const ANTIGRAVITY_SUMMARY = {
  groups: [{
    displayName: "Gemini Models",
    description: "Models within this group: Gemini Flash, Gemini Pro",
    buckets: [
      { bucketId: "gemini-weekly", displayName: "Weekly Limit Remaining", window: "weekly", resetTime: "2026-09-11T05:33:02Z", remainingFraction: 0.9895059 },
      { bucketId: "gemini-5h", displayName: "Five Hour Limit Remaining", window: "5h", resetTime: "2026-09-04T10:33:02Z", remainingFraction: 0.9870351 }
    ]
  }]
};

describe("provider quota probe", () => {
  it("asks the gateway to sign the call and never handles the token itself", async () => {
    const request = vi.fn(async () => ({ status_code: 200, body: CODEX_USAGE }));
    const quota = await probeAccountQuota(request as never, "management-key", account());

    const [path, options] = request.mock.calls[0] as [string, { credentialId: string; body: Record<string, unknown> }];
    expect(path).toBe("/v0/management/api-call");
    expect(options.credentialId).toBe("management-key");
    expect(options.body).toMatchObject({ auth_index: "idx-1", url: "https://chatgpt.com/backend-api/wham/usage" });
    // The plugin names a credential; the gateway substitutes the secret.
    expect(JSON.stringify(options.body)).toContain("$TOKEN$");
    expect(JSON.stringify(options.body)).not.toMatch(/sk-|ya29\./u);

    // Providers report what is used; the panel answers what is left.
    expect(quota).toMatchObject({
      plan: "plus",
      resetCredits: 2,
      credits: { unlimited: false, balance: 0 },
      windows: [
        { windowMinutes: 300, remainingPercent: 0, resetInSeconds: 11414 },
        { windowMinutes: 10080, remainingPercent: 68 }
      ]
    });
  });

  it("keeps a provider's model families in separate pools", async () => {
    const request = vi.fn(async () => ({ status_code: 200, body: ANTIGRAVITY_SUMMARY }));
    const quota = await probeAccountQuota(request as never, "management-key",
      account({ provider: "antigravity", projectId: "aicode-consumers" }));

    expect(request.mock.calls[0]?.[1]).toMatchObject({ body: { data: JSON.stringify({ project: "aicode-consumers" }) } });
    expect(quota?.groups).toHaveLength(1);
    // Shortest window first, so the one about to bite reads first.
    expect(quota?.groups?.[0]).toMatchObject({
      name: "Gemini Models",
      windows: [{ windowMinutes: 300, label: "Five Hour Limit Remaining" }, { windowMinutes: 10080 }]
    });
    expect(Math.round(quota?.groups?.[0]?.windows[0]?.remainingPercent ?? 0)).toBe(99);
  });

  it("falls through to the next host when one refuses, and reports a total failure", async () => {
    const request = vi.fn(async () => ({ status_code: 403 }));
    const target = account({ provider: "antigravity", projectId: "p" });
    await expect(probeAccountQuota(request as never, "management-key", target)).rejects.toThrow();
    // Google serves this from three hosts; one 403 is not the answer.
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("offers no probe for a provider it cannot describe, or a credential it cannot address", () => {
    expect(hasQuotaProbe(account())).toBe(true);
    expect(hasQuotaProbe(account({ provider: "kimi" }))).toBe(false);
    // Antigravity quota is billed to a project; without one there is nothing to ask.
    expect(hasQuotaProbe(account({ provider: "antigravity" }))).toBe(false);
  });
});
