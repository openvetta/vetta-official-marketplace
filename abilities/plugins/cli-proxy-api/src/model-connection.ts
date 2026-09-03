import { API_CREDENTIAL, SERVICE_ID, createProxyClient } from "./proxy-client";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";

/** Keep the discovered provider endpoint current even when the detail slot is not mounted. */
export function maintainModelConnection(context: ManagedPluginContext) {
  const client = createProxyClient(context);
  let active = true;
  let generation = 0;
  let phase: ServiceStatus["phase"] | undefined;
  let pending = Promise.resolve();
  let lastError: unknown;
  const update = (status: ServiceStatus) => {
    if (!active || status.serviceId !== SERVICE_ID || status.phase === phase) return;
    phase = status.phase;
    const current = ++generation;
    if (phase !== "ready") return;
    pending = pending.then(async () => {
      if (!active || current !== generation) return;
      const payload = await client.serviceRequest<unknown>("/v1/models", { credentialId: API_CREDENTIAL });
      if (!active || current !== generation) return;
      await client.publishModels(client.readModels(payload), () => active && current === generation);
      lastError = undefined;
    }).catch((error: unknown) => { lastError = error; });
  };
  const subscription = context.services.onStatusChange(update);
  void context.services.getStatus(SERVICE_ID).then((status) => {
    if (phase === undefined) update(status);
  }).catch((error: unknown) => { lastError = error; });
  return {
    get error() { return lastError; },
    async dispose() {
      active = false;
      generation += 1;
      subscription.dispose();
      await pending;
    }
  };
}
