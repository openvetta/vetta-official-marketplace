import { describe, expect, it } from "vitest";
import { loginSessionStatus } from "../login/session-status.js";

describe("loginSessionStatus", () => {
	it("keeps an unauthenticated session waiting before its deadline", () => {
		expect(loginSessionStatus({ createdAt: 1_000, now: 180_999, loggedIn: false })).toBe("waiting");
	});

	it("expires an unauthenticated session instead of completing it", () => {
		expect(loginSessionStatus({ createdAt: 1_000, now: 181_000, loggedIn: false })).toBe("expired");
	});

	it("accepts a genuinely authenticated session", () => {
		expect(loginSessionStatus({ createdAt: 1_000, now: 181_000, loggedIn: true })).toBe("authenticated");
	});
});
