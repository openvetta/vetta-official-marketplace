import { describe, expect, it } from "vitest";
import { readFeishuUserIdentity } from "../abilities/plugins/feishu/src/auth-status";

describe("readFeishuUserIdentity", () => {
  it("returns the verified user identity and scope count", () => {
    const output = JSON.stringify({
      appId: "cli_example",
      identity: "user",
      identities: {
        user: {
          status: "ready",
          available: true,
          openId: "ou_123",
          userName: "Vetta User",
          tokenStatus: "valid",
          scope: ["docx:document:readonly", "im:message"]
        }
      }
    });

    expect(readFeishuUserIdentity(output)).toEqual({
      openId: "ou_123",
      userName: "Vetta User",
      tokenStatus: "valid",
      scopeCount: 2
    });
  });

  it("supports a success envelope and notice text before JSON", () => {
    const output = `update notice\n${JSON.stringify({
      ok: true,
      data: {
        identities: {
          user: { status: "ready", openId: "ou_456", tokenStatus: "needs_refresh", scope: "a,b c" }
        }
      }
    })}`;

    expect(readFeishuUserIdentity(output)).toEqual({
      openId: "ou_456",
      userName: null,
      tokenStatus: "needs_refresh",
      scopeCount: 3
    });
  });

  it.each([
    { status: "missing", available: false, openId: "" },
    { status: "ready", available: true, openId: "ou_expired", tokenStatus: "expired" }
  ])("rejects an unavailable user identity", (user) => {
    expect(readFeishuUserIdentity(JSON.stringify({ identities: { user } }))).toBeNull();
  });
});
