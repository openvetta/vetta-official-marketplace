import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import { MemoryServices } from "../domain/memory-services";
import { MemoryManagerView } from "../features/memory-manager/components/memory-manager-view";
import type { MemoryManagerDeps } from "../shared/state/manager-deps";
import { FakeStorage } from "./fake-storage";

// jsdom lacks the pointer/scroll APIs Radix' select and dialog rely on.
beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
});

// The real hook resolves catalog keys against locales/en.json; mirror that so a missing key fails a test.
// The host renders `ModelPicker` itself, so the test swaps in a plain select of the same shape.
vi.mock("@vetta-org/plugin-sdk", async () => {
    const { createElement } = await import("react");
    return {
        useTranslation: () => ({
            locale: "en",
            t: (key: string, params?: Record<string, string | number>) => {
                const text = (en as Record<string, string>)[key];
                if (text === undefined) throw new Error(`Missing locale key: ${key}`);
                return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params?.[name] ?? ""));
            },
        }),
        ModelPicker: ({
            value,
            onChange,
            emptyOption,
            ariaLabel,
        }: {
            value: string | null;
            onChange: (modelKey: string | null) => void;
            emptyOption?: { label: string };
            ariaLabel?: string;
        }) =>
            createElement(
                "select",
                { "aria-label": ariaLabel, value: value ?? "", onChange: (event: { target: EventTarget & HTMLSelectElement }) => onChange(event.target.value || null) },
                [
                    ...(emptyOption ? [createElement("option", { key: "", value: "" }, emptyOption.label)] : []),
                    createElement("option", { key: "p/fast", value: "p/fast" }, "Fast model"),
                ],
            ),
    };
});

afterEach(cleanup);

/** Radix selects open a listbox; pick an option by its visible label. */
async function choose(user: ReturnType<typeof userEvent.setup>, scope: HTMLElement, label: string, option: string) {
    await user.click(within(scope).getByLabelText(label));
    await user.click(await screen.findByRole("option", { name: option }));
}

function setup() {
    const services = new MemoryServices(new FakeStorage());
    const notify = vi.fn();
    const deps: MemoryManagerDeps = { services, notify };
    render(<MemoryManagerView deps={deps} />);
    return { services, notify, user: userEvent.setup() };
}

describe("Memory page", () => {
    it("adds a memory, finds it with search, and shows it to the AI store", async () => {
        const { services, user } = setup();
        expect(await screen.findByText("No memories yet")).toBeTruthy();

        await user.click(screen.getByRole("button", { name: "Add memory" }));
        const dialog = screen.getByRole("dialog", { name: "Add memory" });
        await user.type(within(dialog).getByRole("textbox"), "Always deploy on Fridays #decision");
        await choose(user, dialog, "Kind", "Decision");
        await user.click(within(dialog).getByRole("button", { name: "Save" }));

        expect(await screen.findByText("Always deploy on Fridays #decision")).toBeTruthy();
        expect(services.memories.list()[0]).toMatchObject({ kind: "decision", source: "user" });

        await user.type(screen.getByRole("searchbox", { name: "Search memories" }), "nothing like this");
        expect(await screen.findByText("No memory matches")).toBeTruthy();
    });

    it("refuses to save something that looks like a secret", async () => {
        const { services, user } = setup();
        await user.click(await screen.findByRole("button", { name: "Add memory" }));
        const dialog = screen.getByRole("dialog");
        await user.type(within(dialog).getByRole("textbox"), "my key is sk-abcdefghijklmnopqrstuvwxyz");
        await user.click(within(dialog).getByRole("button", { name: "Save" }));
        expect((await within(dialog).findByRole("alert")).textContent).toContain("password or key");
        expect(services.memories.list()).toHaveLength(0);
    });

    it("deletes with undo, and restores from Recently deleted after the undo bar is gone", async () => {
        const { services, user } = setup();
        await services.memories.add({ content: "Prefers dark mode", kind: "preference" });
        const row = (await screen.findByText("Prefers dark mode")).closest("li")!;
        await user.click(within(row).getByRole("button", { name: "Delete" }));

        expect(screen.queryByText("Prefers dark mode")).toBeNull();
        expect(screen.getByRole("status").textContent).toContain("Deleted: Prefers dark mode");
        await user.click(screen.getByRole("button", { name: "Undo" }));
        expect(await screen.findByText("Prefers dark mode")).toBeTruthy();

        const again = screen.getByText("Prefers dark mode").closest("li")!;
        await user.click(within(again).getByRole("button", { name: "Delete" }));
        await user.click(screen.getByRole("tab", { name: /Recently deleted/ }));
        // The earlier undo left a "Restored" entry behind (disabled button); pick the live one.
        const restore = (await screen.findAllByRole("button", { name: "Restore" })).find((button) => !(button as HTMLButtonElement).disabled)!;
        await user.click(restore);
        await waitFor(() => expect(services.memories.list()).toHaveLength(1));
        expect((await screen.findAllByText("Restored")).length).toBe(2);
    });

    it("pins a memory and toggles memory off from the header", async () => {
        const { services, user } = setup();
        await services.memories.add({ content: "Uses Neovim" });
        await user.click(await screen.findByRole("button", { name: "Pin: always include" }));
        await waitFor(() => expect(services.memories.list()[0].pinned).toBe(true));

        await user.click(screen.getByRole("switch", { name: "Memory on" }));
        await waitFor(() => expect(services.memories.getSettings().enabled).toBe(false));
    });

    it("manages the scratchpad", async () => {
        const { services, user } = setup();
        await user.click(await screen.findByRole("tab", { name: /Scratchpad/ }));
        await user.type(screen.getByRole("textbox", { name: "Add something to come back to" }), "Review the release notes");
        await user.click(screen.getByRole("button", { name: "Add" }));
        const box = await screen.findByRole("switch", { name: "Review the release notes" });
        await user.click(box);
        await waitFor(() => expect(services.scratchpad.list()[0].done).toBe(true));
        await user.click(screen.getByRole("button", { name: "Clear finished" }));
        await waitFor(() => expect(services.scratchpad.list()).toHaveLength(0));
    });

    it("adds a daily note and lists it under today", async () => {
        const { services, user } = setup();
        await user.click(await screen.findByRole("tab", { name: "Daily log" }));
        await user.type(screen.getByRole("textbox", { name: "Add a note to today's log" }), "Shipped the migration");
        await user.click(screen.getByRole("button", { name: "Add" }));
        expect(await screen.findByText("Shipped the migration")).toBeTruthy();
        expect((await services.daily.listDates()).length).toBe(1);
    });

    it("changes settings and confirms before clearing everything", async () => {
        const { services, user } = setup();
        await services.memories.add({ content: "Something to wipe" });
        await user.click(await screen.findByRole("tab", { name: "Settings" }));

        await user.click(screen.getByRole("switch", { name: "Learn automatically" }));
        await waitFor(() => expect(services.memories.getSettings().autoExtract).toBe(true));
        await choose(user, document.body, "Prompt refresh", "Every turn");
        await waitFor(() => expect(services.memories.getSettings().snapshotMode).toBe("per-turn"));
        const limit = screen.getByRole("spinbutton", { name: "Memories shown per turn" });
        await user.clear(limit);
        await user.type(limit, "12");
        await user.tab();
        await waitFor(() => expect(services.memories.getSettings().injectLimit).toBe(12));
        await user.selectOptions(screen.getByLabelText("Model for learning and summaries"), "p/fast");
        await waitFor(() => expect(services.memories.getSettings().modelKey).toBe("p/fast"));

        await user.click(screen.getAllByRole("button", { name: "Delete all memories" })[0]);
        const dialog = screen.getByRole("dialog");
        await user.click(within(dialog).getByRole("button", { name: "Delete all memories" }));
        await waitFor(() => expect(services.memories.list()).toHaveLength(0));
        expect(services.recovery.list()[0].reason).toBe("clear");
    });
});
