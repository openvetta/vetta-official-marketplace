import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const catalogPath = join(root, ".vetta", "marketplace.json");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const nextVersion = option("--marketplace-version");
const minAppVersion = option("--min-app-version");
const selected = args.flatMap((value, index) => value === "--slug" ? [args[index + 1]] : []);
const all = args.includes("--all");
const artifactDir = resolve(option("--artifacts-dir") ?? join(root, ".release-artifacts"));
const versionParts = (value) => {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})-([1-9]\d*)$/.exec(value);
  if (!match) throw new Error(`Invalid marketplace version: ${value}`);
  return match.slice(1).map(Number);
};

if (!nextVersion || !/^\d{4}\.\d{2}\.\d{2}-[1-9]\d*$/.test(nextVersion) ||
    !minAppVersion || !/^\d+\.\d+\.\d+$/.test(minAppVersion) ||
    (all === (selected.length > 0))) {
  throw new Error("Usage: node scripts/stage-v3-catalog.mjs --marketplace-version YYYY.MM.DD-N --min-app-version x.y.z (--all | --slug ID ...) [--artifacts-dir PATH]");
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
if (![2, 3].includes(catalog.schemaVersion)) throw new Error("Catalog must use schema v2 or v3");
const currentParts = versionParts(catalog.marketplaceVersion);
const nextParts = versionParts(nextVersion);
const advances = nextParts.some((part, index) => part > currentParts[index] &&
  nextParts.slice(0, index).every((earlier, earlierIndex) => earlier === currentParts[earlierIndex]));
if (!advances) throw new Error("Marketplace version must advance");
if (catalog.schemaVersion === 2) {
  if (!all) throw new Error("The first v3 catalog must stage every plugin");
  catalog.schemaVersion = 3;
  catalog.minAppVersion = minAppVersion;
}

const plugins = [];
for (const ability of catalog.abilities) {
  if (ability.type === "plugin") plugins.push(ability);
  if (ability.type === "bundle") {
    for (const member of ability.config.members) {
      if (member.type === "plugin" && member.source) plugins.push(member);
    }
  }
}
const slugs = all ? plugins.map((plugin) => plugin.slug) : selected;
if (new Set(slugs).size !== slugs.length) throw new Error("Duplicate plugin slug");
for (const slug of slugs) {
  const plugin = plugins.find((entry) => entry.slug === slug);
  if (!plugin) throw new Error(`Unknown plugin: ${slug}`);
  const descriptor = JSON.parse(readFileSync(join(root, plugin.source.path, "plugin.json"), "utf8"));
  if (descriptor.id !== slug) throw new Error(`Plugin identity mismatch: ${slug}`);
  const prefix = `${slug}-${descriptor.version}`;
  const archive = readFileSync(join(artifactDir, `${prefix}.zip`));
  const release = JSON.parse(readFileSync(join(artifactDir, `${prefix}.json`), "utf8"));
  if (release.version !== descriptor.version || release.minAppVersion !== minAppVersion ||
      release.pluginApiVersion !== descriptor.pluginApiVersion ||
      JSON.stringify(release.permissions) !== JSON.stringify(descriptor.permissions ?? []) ||
      JSON.stringify(release.commands) !== JSON.stringify(descriptor.commands ?? []) ||
      release.artifact.sha256 !== createHash("sha256").update(archive).digest("hex") ||
      !release.artifact.url.startsWith(`${catalog.repository}/releases/download/`)) {
    throw new Error(`Staged release does not match plugin source or archive: ${slug}`);
  }
  const existing = plugin.releases ?? [];
  const previous = existing.find((item) => item.version === release.version);
  if (previous && JSON.stringify(previous) !== JSON.stringify(release)) {
    throw new Error(`Cannot replace an existing plugin release: ${slug}@${release.version}`);
  }
  if (!previous) plugin.releases = [...existing, release];
  if (plugin.type === "plugin") plugin.version = descriptor.version;
}
for (const plugin of plugins) {
  if (!plugin.releases?.length) throw new Error(`Missing plugin releases: ${plugin.slug}`);
}
catalog.marketplaceVersion = nextVersion;
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
process.stdout.write(`Staged ${slugs.length} plugin releases in marketplace ${nextVersion}. Publication checks are still required.\n`);
