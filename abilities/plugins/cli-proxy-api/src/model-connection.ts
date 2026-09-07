import { SERVICE_ID, createProxyClient } from "./proxy-client";
import { readModelSelection } from "./model-selection";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";

const STATUS_RECONCILE_INTERVAL_MS = 500;
const FAILURE_RETRY_INTERVAL_MS = 10_000;
/**
 * How long to keep re-observing while the gateway is still registering models.
 *
 * A cold-started gateway answers `/v1/models` for the channels it has finished
 * wiring; the rest arrive over the next seconds. Retention cannot cover this on
 * a fresh install — there is nothing published to retain — so the pass repeats
 * until the credentials' claims are all registered. The ladder is a backoff,
 * not a settle window: the evidence decides when to stop, and exhausting it
 * only means this run stops adding, never that anything is removed.
 */
const OBSERVATION_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000, 5_000, 10_000] as const;

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
  /** How many follow-up observations this ready period has already used. */
  let observation = 0;
  const cancelRetry = () => {
    if (retryTimer === undefined) return;
    clearTimeout(retryTimer);
    retryTimer = undefined;
  };
  const scheduleRetry = (current: number, delayMs: number) => {
    if (!active || current !== generation || phase !== "ready" || retryTimer !== undefined) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      synchronize(current);
    }, delayMs);
  };
  const synchronize = (current: number) => {
    pending = pending.then(async () => {
      if (!active || current !== generation || phase !== "ready") return;
      const [{ models, complete }, selection] = await Promise.all([
        client.loadPublishableModels(),
        readModelSelection(context)
      ]);
      if (!active || current !== generation || phase !== "ready") return;
      // Reconciled against what the host holds, so this set never drops a model
      // merely because the gateway had not registered its credential yet.
      await client.publishModels(models, () => active && current === generation && phase === "ready", selection);
      lastError = undefined;
      // Publishing what is known so far is right either way; an incomplete pass
      // just means there is more to come, so look again.
      if (!complete) {
        const delay = OBSERVATION_RETRY_DELAYS_MS[observation];
        if (delay !== undefined) {
          observation += 1;
          scheduleRetry(current, delay);
        }
      }
    }).catch((error: unknown) => {
      lastError = error;
      scheduleRetry(current, FAILURE_RETRY_INTERVAL_MS);
    });
  };
  const update = (status: ServiceStatus) => {
    if (!active || status.serviceId !== SERVICE_ID || status.phase === phase) return;
    phase = status.phase;
    const current = ++generation;
    cancelRetry();
    observation = 0;
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
