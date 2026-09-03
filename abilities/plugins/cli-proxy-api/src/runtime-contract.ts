import type { Disposable, PluginContext } from "@vetta-org/plugin-sdk";

export type ServicePhase = "disabled" | "installing" | "starting" | "ready" | "stopping" | "stopped" | "failed";

export interface ServiceStatus {
  serviceId: string;
  phase: ServicePhase;
  version: string;
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
  getStatus(serviceId: string): Promise<ServiceStatus>;
  start(serviceId: string): Promise<ServiceStatus>;
  stop(serviceId: string): Promise<ServiceStatus>;
  restart(serviceId: string): Promise<ServiceStatus>;
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

export interface ManagedModelsApi {
  upsertProvider(providerId: string, data: {
    baseUrl: string;
    apiKey: string;
    api: string;
    displayName: string;
    models: Array<{ id: string; name?: string; api?: string; reasoning?: boolean }>;
  }): Promise<void>;
  removeProvider(providerId: string): Promise<void>;
}

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
