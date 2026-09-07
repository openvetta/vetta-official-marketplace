import { SERVICE_ID, createProxyClient } from "./proxy-client";
import { readModelSelection } from "./model-selection";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";

const STATUS_RECONCILE_INTERVAL_MS = 500;

/** Keep the discovered provider endpoint current even when the detail slot is not mounted. */
export function maintainModelConnection(context: ManagedPluginContext) {
  const client = createProxyClient(context);
  let active = true;
  let generation = 0;
  let phase: ServiceStatus["phase"] | undefined;
  let pending = Promise.resolve();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let statusTimer: ReturnType<typeof setInterval> | undefined;
  let lastError: unknown;
  const cancelRetry = () => {
    if (retryTimer === undefined) return;
    clearTimeout(retryTimer);
    retryTimer = undefined;
  };
  /** Only failures come back here: a successful pass needs no re-read. */
  const scheduleRetry = (current: number) => {
    if (!active || current !== generation || phase !== "ready" || retryTimer !== undefined) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      synchronize(current);
    }, 10_000);
  };
  const synchronize = (current: number) => {
    pending = pending.then(async () => {
      if (!active || current !== generation || phase !== "ready") return;
      const [{ models }, selection] = await Promise.all([client.loadPublishableModels(), readModelSelection(context)]);
      if (!active || current !== generation || phase !== "ready") return;
      // `loadPublishableModels` has already reconciled against what the host
      // holds, so this set never drops a model merely because the gateway had
      // not finished registering its credential when the read went out.
      await client.publishModels(models, () => active && current === generation && phase === "ready", selection);
      lastError = undefined;
    }).catch((error: unknown) => {
      lastError = error;
      scheduleRetry(current);
    });
  };
  const update = (status: ServiceStatus) => {
    if (!active || status.serviceId !== SERVICE_ID || status.phase === phase) return;
    phase = status.phase;
    const current = ++generation;
    cancelRetry();
    if (phase !== "ready") return;
    synchronize(current);
  };
  const subscription = context.services.onStatusChange(update);
  // The host broadcasts status transitions over IPC, but activation and child
  // startup race with that broadcast.  Polling the authoritative status closes
  // the gap so a missed `starting -> ready` event cannot suppress model sync.
  statusTimer = setInterval(() => {
    void context.services.getStatus(SERVICE_ID).then((status) => {
      if (phase !== status.phase) update(status);
    }).catch((error: unknown) => { lastError = error; });
  }, STATUS_RECONCILE_INTERVAL_MS);
  void context.services.getStatus(SERVICE_ID).then((status) => {
    if (phase === undefined) update(status);
  }).catch((error: unknown) => { lastError = error; });
  return {
    get error() { return lastError; },
    async dispose() {
      active = false;
      generation += 1;
      cancelRetry();
      if (statusTimer !== undefined) clearInterval(statusTimer);
      subscription.dispose();
      await pending;
    }
  };
}
