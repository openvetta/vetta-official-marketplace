// @vitest-environment happy-dom
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ShimoRuntime } from "../runtime";
import { useReadingAiModel } from "./useReadingAiModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Shimo reading model state", () => {
  it("loads host models, adopts the available default once, and persists later choices", async () => {
    const saveAiSettings = vi.fn(async () => undefined);
    const runtime = {
      repository: {
        getAiSettings: vi.fn(async () => ({ schemaVersion: 1 as const })),
        saveAiSettings,
      },
      context: {
        ai: {
          listModels: vi.fn(async () => ({
            defaultModel: "provider/second",
            models: [
              {
                modelKey: "provider/first",
                provider: "provider",
                id: "first",
                name: "First",
                api: "openai-responses",
                reasoning: false,
                input: ["text" as const],
                contextWindow: 128_000,
              },
              {
                modelKey: "provider/second",
                provider: "provider",
                id: "second",
                name: "Second",
                api: "openai-responses",
                reasoning: false,
                input: ["text" as const],
                contextWindow: 128_000,
              },
            ],
          })),
        },
      },
    } as unknown as ShimoRuntime;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Consumer(): ReactElement {
      const state = useReadingAiModel(runtime);
      return (
        <div>
          <span>{state.loading ? "loading" : `${state.modelKey}:${state.defaultModelKey}`}</span>
          <button type="button" onClick={() => void state.select("provider/first")}>select first</button>
        </div>
      );
    }

    await act(async () => {
      root.render(<Consumer />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("provider/second:provider/second");
    expect(saveAiSettings).toHaveBeenCalledWith({ schemaVersion: 1, modelKey: "provider/second" });

    await act(async () => {
      container.querySelector("button")?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("provider/first");
    expect(saveAiSettings).toHaveBeenLastCalledWith({ schemaVersion: 1, modelKey: "provider/first" });
    await act(async () => root.unmount());
  });
});
