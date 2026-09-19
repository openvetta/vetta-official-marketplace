import assert from "node:assert/strict";
import test from "node:test";

import {
  createPluginReleasePlan,
  nextMarketplaceVersion,
  shanghaiDate,
} from "../scripts/plugin-release-context.mjs";

const catalog = {
  schemaVersion: 3,
  marketplaceVersion: "2026.09.19-1",
  minAppVersion: "0.5.59",
  abilities: [{
    type: "plugin",
    slug: "demo-plugin",
    version: "1.2.0",
    source: { path: "abilities/plugins/demo-plugin" },
    releases: [{ version: "1.1.0" }],
  }],
};
const descriptor = { id: "demo-plugin", version: "1.2.0" };

test("marketplace versions advance using the Shanghai release date without regressing", () => {
  assert.equal(nextMarketplaceVersion("2026.09.19-1", "2026.09.19"), "2026.09.19-2");
  assert.equal(nextMarketplaceVersion("2026.09.19-7", "2026.09.20"), "2026.09.20-1");
  assert.equal(nextMarketplaceVersion("2026.09.20-2", "2026.09.19"), "2026.09.20-3");
  assert.equal(shanghaiDate(new Date("2026-09-19T16:30:00.000Z")), "2026.09.20");
});

test("a release plan uses an immutable vettapkg asset and a review branch", () => {
  assert.deepEqual(createPluginReleasePlan({
    catalog,
    descriptor,
    slug: "demo-plugin",
    minAppVersion: "0.5.60",
    date: "2026.09.19",
  }), {
    slug: "demo-plugin",
    version: "1.2.0",
    sourcePath: "abilities/plugins/demo-plugin",
    minAppVersion: "0.5.60",
    assetName: "demo-plugin-1.2.0.vettapkg",
    tag: "plugin-demo-plugin-1.2.0",
    releaseBranch: "automation/plugin-demo-plugin-1.2.0",
    marketplaceVersion: "2026.09.19-2",
  });
});

test("a release plan rejects reused versions and incompatible App versions", () => {
  const released = structuredClone(catalog);
  released.abilities[0].releases.push({ version: "1.2.0" });
  assert.throws(() => createPluginReleasePlan({
    catalog: released,
    descriptor,
    slug: "demo-plugin",
    date: "2026.09.19",
  }), /already registered/u);
  assert.throws(() => createPluginReleasePlan({
    catalog,
    descriptor,
    slug: "demo-plugin",
    minAppVersion: "0.5.58",
    date: "2026.09.19",
  }), /below marketplace minimum/u);
  const unsafe = structuredClone(catalog);
  unsafe.abilities[0].source.path = "../outside";
  assert.throws(() => createPluginReleasePlan({
    catalog: unsafe,
    descriptor,
    slug: "demo-plugin",
    date: "2026.09.19",
  }), /Unsafe plugin source path/u);
});
