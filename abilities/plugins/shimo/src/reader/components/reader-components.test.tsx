// @vitest-environment happy-dom
import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import type { ModelSelectorViewProps } from "@vetta/theme-ui/plugin-ui";
import {
  act,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../../classification";
import type { LibraryEntry, ReadingRecord } from "../../domain";
import { ReaderDropTarget } from "../../reader";
import { LibrarySidebar } from "./LibrarySidebar";
import { NoteComposer } from "./NoteComposer";
import { PreferencesPopover } from "./PreferencesPopover";
import { QuestionComposer } from "./QuestionComposer";
import { ReaderHeader } from "./ReaderHeader";
import { RecordList } from "./RecordList";
import { RecordsDrawer } from "./RecordsDrawer";
import { SelectionToolbar } from "./SelectionToolbar";

vi.mock("@vetta/ui", () => ({
  Button: ({ children, asChild: _asChild, size: _size, variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; size?: string; variant?: string }) => <button {...props}>{children}</button>,
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children, showCloseButton: _showCloseButton, ...props }: HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean }) => <div {...props}>{children}</div>,
  DialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DialogFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  Drawer: ({ children, onOpenChange }: { children: ReactNode; onOpenChange?(open: boolean): void }) => (
    <div>
      {children}
      <button type="button" data-testid="drawer-dismiss" onClick={() => onOpenChange?.(false)} />
    </div>
  ),
  DrawerClose: ({ children }: { children: ReactNode }) => <>{children}</>,
  DrawerContent: ({ children, overlayClassName: _overlayClassName, portalContainer, ...props }: HTMLAttributes<HTMLDivElement> & { overlayClassName?: string; portalContainer?: HTMLElement }) => <div data-portal-container={portalContainer?.tagName} {...props}>{children}</div>,
  DrawerDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DrawerHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DrawerTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children, align: _align, sideOffset: _sideOffset, ...props }: HTMLAttributes<HTMLDivElement> & { align?: string; sideOffset?: number }) => <div {...props}>{children}</div>,
  PopoverDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  PopoverHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  PopoverTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  Select: ({ children, onValueChange, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { onValueChange?(value: string): void }) => (
    <select {...props} onChange={(event) => onValueChange?.(event.target.value)}>{children}</select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  Spin: () => <span data-testid="spin" />,
  Switch: ({ checked, onCheckedChange, ...props }: InputHTMLAttributes<HTMLInputElement> & { onCheckedChange?(checked: boolean): void }) => (
    <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange?.(event.target.checked)} {...props} />
  )
}));

vi.mock("@vetta/theme-ui/plugin-ui", () => ({
  PROVIDER_ICONS: { gemini: "gemini-icon", openai: "openai-icon" },
  ModelSelectorView: ({ groups, onModelSelect, selectedModel }: ModelSelectorViewProps) => (
    <select
      data-testid="host-model-selector"
      value={selectedModel}
      onChange={(event) => onModelSelect(event.target.value)}
    >
      {groups.flatMap((group) => group.models).map((model) => (
        <option key={model.key} value={model.key}>{model.displayName}</option>
      ))}
    </select>
  )
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const messages: Record<string, string> = {
  "library.collapse": "Collapse library",
  "library.expand": "Expand library",
  "library.title": "Library",
  "library.materials": "Reading materials",
  "library.filterAll": "All",
  "library.empty": "No materials",
  "library.filteredEmpty": "No materials in this category",
  "library.importHint": "Import material",
  "category.poetry": "Poetry",
  "category.book": "Book",
  "category.article": "Article",
  "records.title": "Reading records",
  "records.count": "Records",
  "records.empty": "No records",
  "records.filterAll": "All",
  "records.filterAnswers": "AI answers",
  "records.filterHighlights": "Highlights",
  "records.filterNotes": "Notes",
  "records.filteredEmpty": "No records in this category",
  "records.kind.answer": "AI answer",
  "records.kind.highlight": "Highlight",
  "records.generating": "Generating",
  "preferences.title": "Reading preferences",
  "preferences.description": "Tune the reader",
  "preferences.pinyin": "Pinyin",
  "preferences.ocr": "OCR",
  "preferences.remember": "Remember position",
  "preferences.hidden": "Hidden",
  "preferences.onDemand": "On demand",
  "preferences.visible": "Visible",
  "preferences.never": "Never",
  "preferences.visiblePages": "Visible pages",
  "ai.model": "Reading model",
  "ai.selectModel": "Select a model",
  "ai.loadingModels": "Loading",
  "ai.reloadModels": "Reload",
  "ai.noModels": "No models",
  "ai.modelRequired": "Choose a model",
  "ai.searchModels": "Search models",
  "ai.clearModelSearch": "Clear model search",
  "ai.modelsHeader": "Models",
  "ai.noModelResults": "No matching models",
  "ai.noModelResultsHint": "Try another name",
  "ai.cloudOnly": "Cloud",
  "ai.vision": "Supports images",
  "ai.defaultModel": "Default",
  "export.title": "Export",
  "export.description": "Export records",
  "export.action": "Export",
  "export.annotatedPdf": "Annotated PDF",
  "selection.actions": "Selection actions",
  "composer.reflectionTitle": "Capture this reflection",
  "composer.noteTitle": "Write a note",
  "composer.description": "Saved with the passage",
  "composer.placeholder": "Write here",
  "composer.inputLabel": "Record text",
  "composer.shortcut": "Ctrl + Enter to save",
  "question.title": "Ask AI",
  "question.description": "Saved to records",
  "question.placeholder": "Ask about this passage",
  "question.inputLabel": "Question",
  "question.ask": "Ask",
  "question.answering": "Answering",
  "common.cancel": "Cancel",
  "common.close": "Close",
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
      onPreferencesOpenChange: vi.fn()
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
    expect(toolbar?.querySelectorAll("svg")).toHaveLength(actions.length);
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

describe("Shimo library and record filters", () => {
  it("filters the library by reading category", async () => {
    const baseEntry = {
      kind: "text",
      sourceBlobId: "blob",
      mimeType: "text/plain",
      sizeBytes: 10,
      createdAt: "2026-09-07T00:00:00.000Z",
      updatedAt: "2026-09-07T00:00:00.000Z",
      status: "active"
    } as const;
    const entries: LibraryEntry[] = [
      { ...baseEntry, id: "poem", title: "Moon poem", category: "poetry", sourceName: "poem.txt" },
      { ...baseEntry, id: "essay", title: "Long essay", category: "article", sourceName: "essay.txt" }
    ];
    const container = await render(
      <LibrarySidebar
        entries={entries}
        open
        t={t}
        onSelect={vi.fn(async () => undefined)}
        onFiles={vi.fn(async () => undefined)}
      />
    );
    const poetryFilter = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Poetry (1)")
    );

    await act(async () => poetryFilter?.click());

    expect(container.textContent).toContain("Moon poem");
    expect(container.textContent).not.toContain("Long essay");
  });

  it("filters reading records by kind", async () => {
    const anchor = { type: "text", start: 0, end: 4, quote: "text", prefix: "", suffix: "" } as const;
    const baseRecord = {
      schemaVersion: 1,
      materialId: "material",
      anchor,
      createdAt: "2026-09-07T00:00:00.000Z",
      updatedAt: "2026-09-07T00:00:00.000Z",
      revision: 1
    } as const;
    const records: ReadingRecord[] = [
      { ...baseRecord, id: "answer", kind: "answer", quote: "Answer quote", body: "Answer body" },
      { ...baseRecord, id: "highlight", kind: "highlight", quote: "Highlight quote" }
    ];
    const container = await render(<RecordList records={records} locale="en" t={t} />);
    const highlightsFilter = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Highlights"
    );

    await act(async () => highlightsFilter?.click());

    expect(container.textContent).toContain("Highlight quote");
    expect(container.textContent).not.toContain("Answer quote");
  });
});

describe("Shimo reading preferences", () => {
  it("writes shared Select and Switch changes through the preferences contract", async () => {
    const onChange = vi.fn(async () => undefined);
    const onAiModelChange = vi.fn(async () => undefined);
    const onClose = vi.fn();
    const container = await render(
      <PreferencesPopover
        preferences={{ schemaVersion: 1, pinyin: "hidden", scannedPdfOcr: "never", rememberPosition: true }}
        aiModels={[
          { modelKey: "provider/reader", provider: "provider", id: "reader", name: "Reader", supportsImage: false },
          { modelKey: "provider/vision", provider: "provider", id: "vision", name: "Vision", supportsImage: true }
        ]}
        aiModelKey="provider/reader"
        defaultAiModelKey="provider/reader"
        aiModelsLoading={false}
        aiModelsError={null}
        canExportPdf={false}
        t={t}
        onClose={onClose}
        onChange={onChange}
        onAiModelChange={onAiModelChange}
        onRefreshAiModels={vi.fn(async () => undefined)}
        onExport={vi.fn(async () => undefined)}
        onExportPdf={vi.fn(async () => undefined)}
      />
    );

    const selects = container.querySelectorAll("select");
    const modelSelector = container.querySelector<HTMLSelectElement>('[data-testid="host-model-selector"]');
    await act(async () => {
      if (!modelSelector) return;
      modelSelector.value = "provider/vision";
      modelSelector.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      const pinyin = selects[1];
      if (!pinyin) return;
      pinyin.value = "visible";
      pinyin.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.click());

    expect(onChange).toHaveBeenCalledWith({ pinyin: "visible" });
    expect(onChange).toHaveBeenCalledWith({ rememberPosition: false });
    expect(onAiModelChange).toHaveBeenCalledWith("provider/vision");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Shimo file drops", () => {
  it("accepts real file drops without showing a sticky full-panel overlay", async () => {
    const onFiles = vi.fn(async () => undefined);
    const container = await render(<ReaderDropTarget onFiles={onFiles}>Reader content</ReaderDropTarget>);
    const dropTarget = container.querySelector("main");
    const file = new File(["content"], "reading.txt", { type: "text/plain" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => index === 0 ? file : null,
      *[Symbol.iterator]() { yield file; }
    } as unknown as FileList;

    const textDrag = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(textDrag, "dataTransfer", { value: { types: ["text/plain"], files } });
    await act(async () => dropTarget?.dispatchEvent(textDrag));
    expect(textDrag.defaultPrevented).toBe(false);

    const fileDrag = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(fileDrag, "dataTransfer", { value: { types: ["Files"], files } });
    await act(async () => dropTarget?.dispatchEvent(fileDrag));
    expect(fileDrag.defaultPrevented).toBe(true);

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: { types: ["Files"], files } });
    await act(async () => dropTarget?.dispatchEvent(drop));

    expect(onFiles).toHaveBeenCalledWith(files);
    expect(container.textContent).toBe("Reader content");
  });
});

describe("Shimo questions", () => {
  it("submits a selected-passage question inside Shimo", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const container = await render(
      <QuestionComposer
        pending={{
          action: ACTIONS.poetry.find((action) => action.id === "ask")!,
          selection: { quote: "明月松间照", anchor: { type: "text", start: 0, end: 6, quote: "明月松间照", prefix: "", suffix: "" }, x: 10, y: 10 }
        }}
        locale="zh"
        t={t}
        modelAvailable
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const textarea = container.querySelector("textarea");
    await act(async () => {
      if (!textarea) return;
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setValue?.call(textarea, "这句营造了什么意境？");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLButtonElement>("button:not([disabled]):last-of-type")?.click());

    expect(onSubmit).toHaveBeenCalledWith("这句营造了什么意境？");
  });
});

describe("Shimo reading records", () => {
  it("closes through the shared Drawer state contract", async () => {
    const onClose = vi.fn();
    const container = await render(<RecordsDrawer records={[]} locale="en" t={t} portalContainer={document.body} onClose={onClose} />);

    expect(container.querySelector('[aria-label="Reading records"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Reading records"]')?.getAttribute("data-portal-container")).toBe("BODY");
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="drawer-dismiss"]')?.click());

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders streamed AI answers as GFM and math without exposing raw markup", async () => {
    const record: ReadingRecord = {
      schemaVersion: 1,
      id: "streaming-answer",
      materialId: "material",
      kind: "answer",
      quote: "Euler identity",
      anchor: { type: "text", start: 0, end: 5, quote: "Euler", prefix: "", suffix: "" },
      body: "| Symbol | Value |\n| --- | --- |\n| Euler | $e^{i\\pi}+1=0$ |\n\n<script>alert('no')</script>",
      modelKey: "provider/reader",
      createdAt: "2026-09-07T00:00:00.000Z",
      updatedAt: "2026-09-07T00:00:00.000Z",
      revision: 1,
    };
    const container = await render(
      <RecordList records={[record]} locale="en" t={t} streamingRecordId={record.id} />,
    );

    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector(".shimo-markdown-table-wrap")?.querySelector("table")).not.toBeNull();
    expect(container.querySelector(".shimo-markdown-table-wrap")?.getAttribute("tabindex")).toBe("0");
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Generating");
    expect(container.querySelector(".shimo-stream-caret")).not.toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).not.toContain("alert('no')");
  });
});
