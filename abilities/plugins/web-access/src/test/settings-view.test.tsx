import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const t = (key: string, values?: Record<string, unknown>) =>
  values && "count" in values ? `${key}:${String(values.count)}` : key;

vi.mock("@vetta-org/plugin-sdk", () => ({
  useTranslation: () => ({ t })
}));

import { DEFAULT_SETTINGS } from "../domain/settings";
import { WebAccessSettingsView } from "../features/settings/components/web-access-settings-view";
import type { NetworkCall, NetworkResult } from "../services/network";
import { createSettingsStore, type SettingsBackend } from "../services/settings-store";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function memoryBackend(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial));
  const secrets = new Map<string, string>();
  const backend: SettingsBackend = {
    storage: {
      readFile: async (path) => files.get(path) ?? null,
      writeFile: async (path, content) => {
        files.set(path, content);
      }
    },
    secrets: {
      get: async (key) => secrets.get(key),
      set: async (key, value) => {
        secrets.set(key, value);
      },
      delete: async (key) => {
        secrets.delete(key);
      },
      keys: async () => [...secrets.keys()]
    }
  };
  return { backend, files, secrets };
}

const ok = (body: string, headers: Record<string, string> = {}): NetworkResult => ({
  ok: true,
  status: 200,
  statusText: "OK",
  headers,
  body
});

/** Stands in for the free Exa endpoint so the page can be rendered without network. */
async function fakeSearch(call: NetworkCall): Promise<NetworkResult> {
  if ((call.json as { method?: string } | undefined)?.method === "initialize") {
    return ok('event: message\ndata: {"result":{}}\n\n', { "mcp-session-id": "s" });
  }
  return ok(
    'event: message\ndata: {"result":{"content":[{"type":"text","text":"Title: Vetta docs\\nURL: https://docs.openvetta.com\\nHighlights:\\nHow it works."}]}}\n\n'
  );
}

describe("Web Access settings page", () => {
  it("loads defaults, saves the form and keeps keys out of settings.json", async () => {
    const { backend, files, secrets } = memoryBackend();
    const store = createSettingsStore(backend);
    const notify = vi.fn();
    render(<WebAccessSettingsView store={store} call={fakeSearch} notify={notify} />);

    await screen.findByRole("radiogroup", { name: "settings.search.provider" });
    expect((screen.getByRole("radio", { name: /provider\.auto/u }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: /provider\.brave/u }));
    fireEvent.change(screen.getByLabelText(/^settings\.search\.count$/u), { target: { value: "3" } });

    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "settings.key.add" })[0]);
    await user.type(screen.getByPlaceholderText("settings.key.placeholder"), "secret-key");
    await user.click(screen.getByRole("button", { name: "settings.key.save" }));
    await waitFor(() => expect(secrets.get("exaApiKey")).toBe("secret-key"));
    await screen.findByText("settings.key.saved");

    await user.click(screen.getByRole("button", { name: "settings.save" }));
    await waitFor(() => expect(files.get("settings.json")).toBeTruthy());

    const saved = JSON.parse(files.get("settings.json") ?? "{}") as Record<string, unknown>;
    expect(saved).toMatchObject({ searchProvider: "brave", resultCount: 3 });
    expect(files.get("settings.json")).not.toContain("secret-key");
    await waitFor(() => expect(notify).toHaveBeenCalledWith("settings.saved"));
  });

  it("runs a real query from the page and shows the answers", async () => {
    const { backend } = memoryBackend();
    const store = createSettingsStore(backend);
    render(<WebAccessSettingsView store={store} call={fakeSearch} notify={vi.fn()} />);

    const user = userEvent.setup();
    await screen.findByRole("button", { name: "settings.test.run" });
    await user.click(screen.getByRole("button", { name: "settings.test.run" }));

    await screen.findByText("Vetta docs");
    expect(screen.getByText("Exa (free)")).toBeTruthy();
    expect(screen.getByText("settings.test.count:1")).toBeTruthy();
    expect(screen.getByText("docs.openvetta.com")).toBeTruthy();
  });

  it("shows the provider's reason when a test search fails", async () => {
    const { backend } = memoryBackend({ "settings.json": JSON.stringify({ ...DEFAULT_SETTINGS, searchProvider: "brave" }) });
    const store = createSettingsStore(backend);
    const failing = async (call: NetworkCall): Promise<NetworkResult> =>
      call.url.includes("brave")
        ? { ok: false, status: 401, statusText: "Unauthorized", headers: {}, body: '{"message":"bad key"}' }
        : ok("");
    render(<WebAccessSettingsView store={store} call={failing} notify={vi.fn()} />);

    const user = userEvent.setup();
    await waitFor(() =>
      expect((screen.getByRole("radio", { name: /provider\.brave/u }) as HTMLInputElement).checked).toBe(true)
    );
    await user.click(screen.getByRole("button", { name: "settings.test.run" }));

    await screen.findByText(/settings.test.failed/u);
    expect(document.body.textContent).toContain("Brave Search needs an API key");
  });

  it("reveals the SearXNG address only when it can be used", async () => {
    const { backend } = memoryBackend();
    const store = createSettingsStore(backend);
    render(<WebAccessSettingsView store={store} call={fakeSearch} notify={vi.fn()} />);

    await screen.findByRole("radiogroup", { name: "settings.search.provider" });
    expect(screen.queryByLabelText(/settings\.search\.searxngUrl/u)).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /provider\.brave/u }));
    expect(screen.queryByLabelText(/settings\.search\.searxngUrl/u)).toBeNull();
  });
});
