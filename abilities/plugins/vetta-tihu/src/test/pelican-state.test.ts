import { beforeEach, describe, expect, it } from "vitest";
import { isScene, MAX_ACTION_COUNT, MAX_SPEED, pelicanStore } from "../domain/pelican-state";

describe("pelicanStore", () => {
	beforeEach(() => pelicanStore.reset());

	it("clamps and rounds the speed level", () => {
		pelicanStore.setSpeed(42);
		expect(pelicanStore.getState().speed).toBe(MAX_SPEED);
		pelicanStore.setSpeed(-3);
		expect(pelicanStore.getState().speed).toBe(0);
		pelicanStore.setSpeed(4.6);
		expect(pelicanStore.getState().speed).toBe(5);
	});

	it("queues jumps up to the pending limit and consumes them one by one", () => {
		pelicanStore.requestJumps(4);
		pelicanStore.requestJumps(4);
		expect(pelicanStore.getState().pendingJumps).toBe(MAX_ACTION_COUNT);
		expect(pelicanStore.getState().totalJumps).toBe(8);

		let consumed = 0;
		while (pelicanStore.consumeJump()) consumed++;
		expect(consumed).toBe(MAX_ACTION_COUNT);
		expect(pelicanStore.consumeJump()).toBe(false);
	});

	it("notifies subscribers until they unsubscribe", () => {
		let calls = 0;
		const unsubscribe = pelicanStore.subscribe(() => calls++);
		pelicanStore.requestBells(1);
		unsubscribe();
		pelicanStore.consumeBell();
		expect(calls).toBe(1);
	});

	it("recognizes only supported scenes", () => {
		expect(isScene("rain")).toBe(true);
		expect(isScene("snow")).toBe(false);
		expect(isScene(1)).toBe(false);
	});
});
