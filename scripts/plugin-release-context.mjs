import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const stableVersionPattern = /^\d+\.\d+\.\d+$/u;
const marketplaceVersionPattern = /^(\d{4})\.(\d{2})\.(\d{2})-([1-9]\d*)$/u;

function numericVersion(value, pattern, label) {
  const match = pattern.exec(value);
  if (!match) throw new Error(`Invalid ${label}: ${value}`);
  return match.slice(1).map(Number);
}

function compareParts(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function nextMarketplaceVersion(current, date) {
  const currentParts = numericVersion(current, marketplaceVersionPattern, "marketplaceVersion");
  const dateParts = numericVersion(`${date}-1`, marketplaceVersionPattern, "release date").slice(0, 3);
  const currentDate = currentParts.slice(0, 3);
  if (compareParts(dateParts, currentDate) > 0) return `${date}-1`;
  return `${currentDate.slice(0, 3).map((part, index) => index === 0 ? String(part).padStart(4, "0") : String(part).padStart(2, "0")).join(".")}-${currentParts[3] + 1}`;
}

export function shanghaiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}.${value.month}.${value.day}`;
}

function findPlugin(catalog, slug) {
  for (const ability of catalog.abilities ?? []) {
    if (ability.type === "plugin" && ability.slug === slug) return ability;
    if (ability.type !== "bundle") continue;
    const member = ability.config?.members?.find((candidate) =>
      candidate.type === "plugin" && candidate.slug === slug && candidate.source);
    if (member) return member;
  }
  throw new Error(`Plugin is not registered in the marketplace: ${slug}`);
}

export function createPluginReleasePlan({ catalog, descriptor, slug, minAppVersion, date }) {
  if (catalog.schemaVersion !== 3) throw new Error("Plugin release automation requires marketplace schema v3");
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(slug)) throw new Error(`Invalid plugin slug: ${slug}`);
  const plugin = findPlugin(catalog, slug);
  const sourcePath = plugin.source?.path;
  if (typeof sourcePath !== "string" || sourcePath.includes("\\") || sourcePath.startsWith("/") ||
      sourcePath.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Unsafe plugin source path: ${sourcePath}`);
  }
  if (descriptor.id !== slug) throw new Error(`Plugin identity mismatch: ${descriptor.id} != ${slug}`);
  if (!stableVersionPattern.test(descriptor.version)) throw new Error(`Plugin version must be stable x.y.z SemVer: ${descriptor.version}`);
  if (plugin.version !== descriptor.version) {
    throw new Error(`Catalog and plugin versions differ: ${plugin.version} != ${descriptor.version}`);
  }
  if (plugin.releases?.some((release) => release.version === descriptor.version)) {
    throw new Error(`Plugin release is already registered: ${slug}@${descriptor.version}`);
  }
  const effectiveMinAppVersion = minAppVersion || catalog.minAppVersion;
  if (!stableVersionPattern.test(effectiveMinAppVersion)) {
    throw new Error(`Minimum App version must be stable x.y.z SemVer: ${effectiveMinAppVersion}`);
  }
  if (compareParts(effectiveMinAppVersion.split(".").map(Number), catalog.minAppVersion.split(".").map(Number)) < 0) {
    throw new Error(`Minimum App version ${effectiveMinAppVersion} is below marketplace minimum ${catalog.minAppVersion}`);
  }
  const version = descriptor.version;
  return {
    slug,
    version,
    sourcePath,
    minAppVersion: effectiveMinAppVersion,
    assetName: `${slug}-${version}.vettapkg`,
    tag: `plugin-${slug}-${version}`,
    releaseBranch: `automation/plugin-${slug}-${version}`,
    marketplaceVersion: nextMarketplaceVersion(catalog.marketplaceVersion, date),
  };
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return value;
}

export function loadPluginReleasePlan(root, args, now = new Date()) {
  const slug = option(args, "--slug");
  if (!slug) throw new Error("Usage: node scripts/plugin-release-context.mjs --slug ID [--min-app-version x.y.z] [--date YYYY.MM.DD]");
  const catalog = JSON.parse(readFileSync(join(root, ".vetta", "marketplace.json"), "utf8"));
  const plugin = findPlugin(catalog, slug);
  const descriptor = JSON.parse(readFileSync(join(root, plugin.source.path, "plugin.json"), "utf8"));
  return createPluginReleasePlan({
    catalog,
    descriptor,
    slug,
    minAppVersion: option(args, "--min-app-version"),
    date: option(args, "--date") ?? shanghaiDate(now),
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const root = resolve(import.meta.dirname, "..");
    process.stdout.write(`${JSON.stringify(loadPluginReleasePlan(root, process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
