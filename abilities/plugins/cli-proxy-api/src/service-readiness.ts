import { API_CREDENTIAL, MANAGER_CREDENTIAL, SERVICE_ID, createProxyClient } from "./proxy-client";
import { readModelSelection } from "./model-selection";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";

const READINESS_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000, 5_000, 10_000] as const;

/**
 * The gateway can answer its transport health endpoint before its account-backed
 * model catalog has been rebuilt. Keep the host in `starting` until the plugin
 * can prove the catalog is semantically usable. A persisted non-empty selection
 * is also evidence that an empty cold-start response is not a settled state.
 */
export function maintainServiceReadiness(context: ManagedPluginContext) {
  const client = createProxyClient(context);
  let active = true;
  let generation = 0;
  let phase: ServiceStatus["phase"] | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let pending = Promise.resolve();

  const cancel = () => {
    if (retryTimer === undefined) return;
    clearTimeout(retryTimer);
    retryTimer = undefined;
  };
  const schedule = (current: number, attempt: number) => {
    if (!active || current !== generation || phase !== "starting" || retryTimer !== undefined) return;
    const delay = READINESS_RETRY_DELAYS_MS[Math.min(attempt, READINESS_RETRY_DELAYS_MS.length - 1)] ?? 10_000;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      probe(current, attempt + 1);
    }, delay);
  };
  const probe = (current: number, attempt: number) => {
    pending = pending.then(async () => {
      if (!active || current !== generation || phase !== "starting") return;
      try {
        const accountsResponse = await client.serviceRequest("/v0/management/auth-files", {
          credentialId: MANAGER_CREDENTIAL,
        });
        const accounts = client.readAccounts(accountsResponse);
        const activeAccounts = accounts.some((account) => account.active);
        const modelsResponse = await client.serviceRequest("/v1/models", { credentialId: API_CREDENTIAL });
        const models = client.readModels(modelsResponse);
        const selection = await readModelSelection(context);
        if (!active || current !== generation || phase !== "starting") return;
        if (models.length === 0 && (activeAccounts || (selection !== null && selection.size > 0))) {
          schedule(current, attempt);
          return;
        }
        await context.services.reportReady(SERVICE_ID, true);
      } catch {
        schedule(current, attempt);
      }
    }).catch(() => schedule(current, attempt));
  };
  const update = (status: ServiceStatus) => {
    if (!active || status.serviceId !== SERVICE_ID || status.phase === phase) return;
    phase = status.phase;
    const current = ++generation;
    cancel();
    if (phase === "starting") probe(current, 0);
  };
  const subscription = context.services.onStatusChange(update);
  void context.services.getStatus(SERVICE_ID).then((status) => {
    if (phase === undefined) update(status);
  }).catch(() => undefined);
  return {
    async dispose() {
      active = false;
      generation += 1;
      cancel();
      subscription.dispose();
      await pending;
    },
  };
}
