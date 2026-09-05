import type { Disposable, PluginContext, PluginModelsApi } from "@vetta-org/plugin-sdk";

export type ServicePhase = "disabled" | "installing" | "starting" | "ready" | "stopping" | "stopped" | "failed";

export interface ServiceStatus {
  serviceId: string;
  phase: ServicePhase;
  version: string;
  installed: boolean;
  message?: string;
  recentOutput: string;
}

export interface ServiceResponse<T> {
  ok: boolean;
  status: number;
  statusText: string;
  body: T;
}

export interface ManagedServiceApi {
  getPlatform(): Promise<{ tag: "win32-x64" | "win32-arm64" | "darwin-x64" | "darwin-arm64" | "linux-x64" | "linux-arm64" }>;
  getStatus(serviceId: string): Promise<ServiceStatus>;
  install(serviceId: string, artifacts: Array<{ destination: string; data: string }>): Promise<ServiceStatus>;
  start(serviceId: string): Promise<ServiceStatus>;
  stop(serviceId: string): Promise<ServiceStatus>;
  restart(serviceId: string): Promise<ServiceStatus>;
  reportReady(serviceId: string, ready: boolean): Promise<ServiceStatus>;
  connection(serviceId: string, credentialId?: string): Promise<{ baseUrl: string; credential?: string }>;
  request<T>(serviceId: string, request: {
    path: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    credentialId?: string;
    body?: unknown;
    responseType?: "json" | "text";
    timeoutMs?: number;
  }): Promise<ServiceResponse<T>>;
  onStatusChange(listener: (status: ServiceStatus) => void): Disposable;
}

export type ManagedModelsApi = PluginModelsApi;

export type ManagedPluginContext = PluginContext & {
  services: ManagedServiceApi;
  models: ManagedModelsApi;
  ui: PluginContext["ui"] & {
    registerAbilityDetailSlot(input: {
      id: string;
      abilityId: string;
      component: () => unknown;
    }): Disposable;
  };
};
