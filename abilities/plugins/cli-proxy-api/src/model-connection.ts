import { SERVICE_ID, createProxyClient } from "./proxy-client";
import { readModelSelection } from "./model-selection";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";

const MODEL_DISCOVERY_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000, 5_000, 10_000] as const;

function retryDelay(attempt: number): number {
  return MODEL_DISCOVERY_RETRY_DELAYS_MS[Math.min(attempt, MODEL_DISCOVERY_RETRY_DELAYS_MS.length - 1)] ?? 10_000;
}

/** Keep the discovered provider endpoint current even when the detail slot is not mounted. */
export function maintainModelConnection(context: ManagedPluginContext) {
  const client = createProxyClient(context);
  let active = true;
  let generation = 0;
  let phase: ServiceStatus["phase"] | undefined;
  let pending = Promise.resolve();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let lastError: unknown;
  const cancelRetry = () => {
    if (retryTimer === undefined) return;
    clearTimeout(retryTimer);
    retryTimer = undefined;
  };
  const scheduleRetry = (current: number, attempt: number) => {
    if (!active || current !== generation || phase !== "ready" || retryTimer !== undefined) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      synchronize(current, attempt + 1);
    }, retryDelay(attempt));
  };
  const synchronize = (current: number, attempt: number) => {
    pending = pending.then(async () => {
      if (!active || current !== generation || phase !== "ready") return;
      const [{ models }, selection] = await Promise.all([client.loadModels(), readModelSelection(context)]);
      if (!active || current !== generation || phase !== "ready") return;
      // The gateway returns 200 before its account-backed routes have finished rebuilding.
      // An empty response at this point is not an authoritative request to erase persisted providers.
      if (models.length === 0) {
        scheduleRetry(current, attempt);
        return;
      }
      await client.publishModels(models, () => active && current === generation && phase === "ready", selection);
      lastError = undefined;
    }).catch((error: unknown) => {
      lastError = error;
      scheduleRetry(current, attempt);
    });
  };
  const update = (status: ServiceStatus) => {
    if (!active || status.serviceId !== SERVICE_ID || status.phase === phase) return;
    phase = status.phase;
    const current = ++generation;
    cancelRetry();
    if (phase !== "ready") return;
    synchronize(current, 0);
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
      cancelRetry();
      subscription.dispose();
      await pending;
    }
  };
}
