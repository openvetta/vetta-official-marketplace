export type LoginSessionStatus = "waiting" | "authenticated" | "expired";

export function loginSessionStatus(input: {
	createdAt: number;
	now: number;
	loggedIn: boolean;
	timeoutMs?: number;
}): LoginSessionStatus {
	if (input.loggedIn) return "authenticated";
	return input.now - input.createdAt < (input.timeoutMs ?? 180_000)
		? "waiting"
		: "expired";
}
