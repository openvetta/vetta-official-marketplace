import type { Disposable, PluginContext } from "@vetta-org/plugin-sdk";

export type ServicePhase = "disabled" | "installing" | "starting" | "ready" | "stopping" | "stopped" | "failed";
export type ServiceStatus = { serviceId: string; phase: ServicePhase; version: string; installed: boolean; message?: string; recentOutput: string };
export interface ManagedServiceApi {
  getPlatform(): Promise<{ tag: string }>;
  getStatus(serviceId: string): Promise<ServiceStatus>;
  install(serviceId: string, artifacts: Array<{ destination: string; data: string }>): Promise<ServiceStatus>;
  start(serviceId: string): Promise<ServiceStatus>;
  stop(serviceId: string): Promise<ServiceStatus>;
  request<T = unknown>(serviceId: string, request: { path: string; method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; responseType?: "json" | "text"; timeoutMs?: number; body?: unknown }): Promise<{ ok: boolean; status: number; statusText: string; body: T }>;
  readDataFile(serviceId: string, path: string, encoding?: "utf8" | "base64"): Promise<string | null>;
  writeDataFile(serviceId: string, path: string, data: string, encoding?: "utf8" | "base64"): Promise<void>;
  onStatusChange(listener: (status: ServiceStatus) => void): Disposable;
}

export interface PluginSecretsApi { get(key: string): Promise<string | undefined>; set(key: string, value: string): Promise<void>; delete(key: string): Promise<void> }

export type ManagedPluginContext = PluginContext & {
  services: ManagedServiceApi;
  secrets: PluginSecretsApi;
  ui: PluginContext["ui"] & {
    registerAbilityDetailSlot(input: {
      id: string;
      abilityId: string;
      component: () => unknown;
    }): Disposable;
  };
};
