import { describe, expect, it } from "vitest";
import { buildProviderPools } from "../src/provider-pools";
import type { ProxyAccount } from "../src/proxy-client";

function account(key: string, displayName: string): ProxyAccount {
  return {
    key,
    provider: "antigravity",
    displayName,
    active: true,
    removable: true,
    disabled: false,
    success: 0,
    failed: 0,
    recentRequests: [],
  };
}

describe("provider pools", () => {
  it("renders one effective route for two accounts from the same supplier", () => {
    const accounts = [account("a", "first@example.com"), account("b", "second@example.com")];
    const pools = buildProviderPools(accounts, new Map([
      ["a", { models: [{ id: "gemini-3.1-pro" }] }],
      ["b", { models: [{ id: "gemini-3.1-pro" }] }],
    ]));

    expect(pools).toHaveLength(1);
    expect(pools[0]).toMatchObject({ id: "antigravity", enabledAccountCount: 2 });
    expect(pools[0]?.models).toEqual([
      expect.objectContaining({
        routeKey: "google/gemini-3.1-pro",
        availableAccountKeys: ["a", "b"],
        enabledAccountCount: 2,
      }),
    ]);
  });

  it("keeps the same model id on different protocol routes independent", () => {
    const accounts = [account("a", "google@example.com"), { ...account("b", "claude@example.com"), provider: "claude" }];
    const pools = buildProviderPools(accounts, new Map([
      ["a", { models: [{ id: "shared-model" }] }],
      ["b", { models: [{ id: "shared-model" }] }],
    ]));

    expect(pools.flatMap((pool) => pool.models.map((model) => model.routeKey))).toEqual([
      "google/shared-model",
      "anthropic/shared-model",
    ]);
  });
});
