import { describe, expect, it } from "vitest";
import { toDisplayErrorMessage } from "../src/error-message";

describe("CLIProxyAPI display errors", () => {
  it("removes Electron and capability plumbing from a user-facing failure", () => {
    const failure = new Error(
      "Error invoking remote method 'vetta:plugins:network:request': CapabilityError: Plugin network request failed (ERR_CONNECTION_RESET)",
    );

    expect(toDisplayErrorMessage(failure)).toBe("Plugin network request failed (ERR_CONNECTION_RESET)");
  });

  it("normalizes and bounds unexpected messages", () => {
    const message = `unexpected\ninternal failure ${"x".repeat(300)}`;

    expect(toDisplayErrorMessage(message)).toHaveLength(240);
    expect(toDisplayErrorMessage(message)).not.toContain("\n");
    expect(toDisplayErrorMessage(message)).toMatch(/…$/);
  });
});

