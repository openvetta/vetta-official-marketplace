import { PROTOCOL_GROUPS, modelChannelFor, protocolGroupFor, type ProtocolGroup } from "./provider-contract";
import type { ProxyAccount, ProxyModel, ModelCatalog, PublishedModel } from "./proxy-client";

/**
 * What one reconciliation pass gets to look at.
 *
 * `published` is what the host currently holds for this plugin; `undefined`
 * means the host offers no read-back, and the pass degrades to publishing
 * whatever is routable right now.
 */
export type ReconcileSources = {
  published: readonly PublishedModel[] | undefined;
  routable: readonly ProxyModel[];
  accounts: readonly ProxyAccount[];
  catalog: ModelCatalog;
};

/**
 * Decides the complete set to publish, given everything one pass could observe.
 *
 * Publishing replaces the plugin's whole namespace, so an omission is a
 * deletion. The gateway registers a credential's models asynchronously — a
 * cold-started process answers `/v1/models` with the channels it has finished
 * wiring and none of the others — so "not in this read" cannot be allowed to
 * mean "the user no longer has it". Removal therefore needs positive evidence:
 *
 *   - no enabled credential backs the group any more (the credential was
 *     deleted or switched off; `auth-files` is disk-backed and authoritative
 *     from the first millisecond), or
 *   - the credentials that do back it answered with their catalog this pass,
 *     and that catalog no longer lists the model.
 *
 * Anything else — a channel that answered nothing, a credential whose provider
 * this plugin does not recognise — is missing evidence, not evidence of
 * absence, and the previously published model stays.
 */
export function reconcileModels({ published, routable, accounts, catalog }: ReconcileSources): PublishedModel[] {
  const next = new Map<string, PublishedModel>();
  for (const model of groupModels(routable)) next.set(`${model.group}/${model.id}`, model);
  if (!published) return sortModels([...next.values()]);

  // What the enabled credentials say they can route. `backed` answers "may this
  // group exist at all", `claimed` answers "is this specific model still on
  // offer", and `unproven` marks groups this pass simply could not ask about.
  const claimed = new Map<ProtocolGroup, Set<string>>();
  const backed = new Set<ProtocolGroup>();
  const unproven = new Set<ProtocolGroup>();
  for (const account of accounts) {
    if (!account.active) continue;
    const channel = modelChannelFor(account.provider);
    const listing = channel === undefined ? undefined : catalog.channels.get(channel);
    if (listing === undefined || listing.length === 0) {
      // The credential exists but this pass cannot tell what it routes. Unknown
      // is not denial: mark every group unproven so nothing is dropped now.
      for (const group of PROTOCOL_GROUPS) {
        backed.add(group);
        unproven.add(group);
      }
      continue;
    }
    for (const model of listing) {
      const group = protocolGroupFor(account.provider, model.id);
      backed.add(group);
      const ids = claimed.get(group);
      if (ids) ids.add(model.id);
      else claimed.set(group, new Set([model.id]));
    }
  }

  for (const model of published) {
    const key = `${model.group}/${model.id}`;
    if (next.has(key)) continue;
    if (!backed.has(model.group)) continue;
    if (claimed.get(model.group)?.has(model.id) || unproven.has(model.group)) next.set(key, model);
  }
  return sortModels([...next.values()]);
}

/** Attaches the protocol group each model is published under. */
export function groupModels(models: readonly ProxyModel[]): PublishedModel[] {
  return models.map((model) => ({ ...model, group: protocolGroupFor(model.ownedBy, model.id) }));
}

function sortModels(models: PublishedModel[]): PublishedModel[] {
  return models.sort((left, right) => left.group.localeCompare(right.group) || left.id.localeCompare(right.id));
}
