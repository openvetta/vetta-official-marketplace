import { describe, expect, it } from "vitest";
import { clampSelectionMenu } from "./selection";

describe("selection toolbar placement", () => {
  it("keeps the toolbar inside all viewport edges", () => {
    expect(clampSelectionMenu({ left: -20, bottom: -30 }, { width: 800, height: 600 })).toEqual({ x: 12, y: 12 });
    expect(clampSelectionMenu({ left: 780, bottom: 590 }, { width: 800, height: 600 })).toEqual({ x: 408, y: 492 });
  });
});
