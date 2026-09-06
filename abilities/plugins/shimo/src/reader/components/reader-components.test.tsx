// @vitest-environment happy-dom
import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { act, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../../classification";
import { NoteComposer } from "./NoteComposer";
import { ReaderHeader } from "./ReaderHeader";
import { SelectionToolbar } from "./SelectionToolbar";

vi.mock("@vetta/ui", () => ({
  Button: ({ children, size: _size, variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; variant?: string }) => <button {...props}>{children}</button>,
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DialogFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const messages: Record<string, string> = {
  "library.collapse": "Collapse library",
  "library.expand": "Expand library",
  "records.title": "Reading records",
  "preferences.title": "Reading preferences",
  "selection.actions": "Selection actions",
  "composer.reflectionTitle": "Capture this reflection",
  "composer.noteTitle": "Write a note",
  "composer.description": "Saved with the passage",
  "composer.placeholder": "Write here",
  "composer.inputLabel": "Record text",
  "composer.shortcut": "Ctrl + Enter to save",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.saving": "Saving"
};
const t: PluginTranslate = (key) => messages[key] ?? key;

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

async function render(element: ReactNode): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mountedRoot = root;
  mountedContainer = container;
  await act(async () => root.render(element));
  return container;
}

afterEach(async () => {
  if (mountedRoot) await act(async () => mountedRoot?.unmount());
  mountedContainer?.remove();
  document.body.replaceChildren();
  mountedRoot = null;
  mountedContainer = null;
});

describe("Shimo progressive disclosure", () => {
  it("keeps task controls hidden until a material is active", async () => {
    const baseProps = {
      title: "Shimo",
      recordCount: 0,
      quiet: false,
      libraryOpen: true,
      recordsOpen: false,
      preferencesOpen: false,
      t,
      onToggleLibrary: vi.fn(),
      onToggleRecords: vi.fn(),
      onTogglePreferences: vi.fn()
    };
    const container = await render(<ReaderHeader {...baseProps} active={false} />);
    expect(container.querySelectorAll("button")).toHaveLength(1);

    await act(async () => mountedRoot?.render(<ReaderHeader {...baseProps} active title="Poems" recordCount={3} />));
    expect(container.querySelectorAll("button")).toHaveLength(3);
  });

  it("shows every category action instead of hiding actions in a more menu", async () => {
    const onAction = vi.fn(async () => undefined);
    const actions = ACTIONS.poetry;
    const container = await render(
      <SelectionToolbar
        selection={{ quote: "明月", anchor: { type: "text", start: 0, end: 2, quote: "明月", prefix: "", suffix: "" }, x: 24, y: 48 }}
        actions={actions}
        locale="zh"
        t={t}
        onAction={onAction}
      />
    );
    const toolbar = container.querySelector('[role="toolbar"]');
    const buttons = toolbar?.querySelectorAll("button") ?? [];

    expect(toolbar?.getAttribute("aria-label")).toBe("Selection actions");
    expect(buttons).toHaveLength(actions.length);
    expect(Array.from(buttons).map((button) => button.textContent)).toEqual(actions.map((action) => action.zh));
    await act(async () => buttons[0]?.click());
    expect(onAction).toHaveBeenCalledWith(actions[0]);
  });
});

describe("Shimo note composer", () => {
  it("captures a reflection without using a browser prompt", async () => {
    const onSave = vi.fn(async () => undefined);
    await render(
      <NoteComposer
        pending={{
          kind: "reflection",
          action: ACTIONS.poetry.find((action) => action.id === "reflection")!,
          selection: { quote: "空山新雨后", anchor: { type: "text", start: 0, end: 5, quote: "空山新雨后", prefix: "", suffix: "" }, x: 20, y: 20 }
        }}
        locale="zh"
        t={t}
        onCancel={vi.fn()}
        onSave={onSave}
      />
    );

    const textarea = document.querySelector("textarea");
    expect(textarea).not.toBeNull();
    await act(async () => {
      if (!textarea) return;
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setValue?.call(textarea, "雨后的静谧让山更显空灵");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      textarea?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    });

    expect(onSave).toHaveBeenCalledWith("雨后的静谧让山更显空灵");
  });
});
