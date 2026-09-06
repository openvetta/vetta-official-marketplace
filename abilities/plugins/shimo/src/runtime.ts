import type { PluginContext } from "@vetta-org/plugin-sdk";
import type { ShimoRepository } from "./repository";

export interface ShimoRuntime {
  context: PluginContext;
  repository: ShimoRepository;
  getSelectedId(): string | null;
  setSelectedId(id: string): void;
  notifyRecordsChanged(materialId: string): void;
  subscribe(listener: (event: ShimoRuntimeEvent) => void): () => void;
}

export type ShimoRuntimeEvent =
  | { type: "material-selected"; materialId: string }
  | { type: "records-changed"; materialId: string };
