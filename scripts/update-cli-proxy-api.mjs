import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDirectory = resolve(root, "abilities/plugins/cli-proxy-api");
const write = process.argv.includes("--write");
const token = process.env.GITHUB_TOKEN?.trim();

const repositories = {
  core: "router-for-me/CLIProxyAPI",
  gemini: "router-for-me/cpa-plugin-gemini-cli",
};

const platforms = {
  "win32-x64": { core: "windows_amd64.zip", gemini: "windows_amd64.zip", coreArchive: "zip" },
  "win32-arm64": { core: "windows_aarch64.zip", gemini: "windows_arm64.zip", coreArchive: "zip" },
  "darwin-x64": { core: "darwin_amd64.tar.gz", gemini: "darwin_amd64.zip", coreArchive: "tar.gz" },
  "darwin-arm64": { core: "darwin_aarch64.tar.gz", gemini: "darwin_arm64.zip", coreArchive: "tar.gz" },
  "linux-x64": { core: "linux_amd64.tar.gz", gemini: "linux_amd64.zip", coreArchive: "tar.gz" },
  "linux-arm64": { core: "linux_aarch64.tar.gz", gemini: "linux_arm64.zip", coreArchive: "tar.gz" },
};

function headers() {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "vetta-cli-proxy-api-updater",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status}): ${url}`);
  return response.json();
}

async function latestStable(repository) {
  const releases = await fetchJson(`https://api.github.com/repos/${repository}/releases?per_page=20`);
  const release = releases.find((candidate) => !candidate.draft && !candidate.prerelease);
  if (!release?.tag_name || !Array.isArray(release.assets)) throw new Error(`No stable release found for ${repository}`);
  return release;
}

function versionFromTag(tag) {
  const value = tag.replace(/^v/u, "");
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(value)) throw new Error(`Unsupported release tag: ${tag}`);
  return value;
}

function assetBySuffix(release, prefix, suffix) {
  const expected = `${prefix}_${versionFromTag(release.tag_name)}_${suffix}`;
  const asset = release.assets.find((candidate) => candidate.name === expected);
  if (!asset?.browser_download_url || !/^sha256:[a-f0-9]{64}$/u.test(asset.digest ?? "")) {
    throw new Error(`Missing fixed-digest release asset: ${expected}`);
  }
  return asset;
}

async function releaseCommit(repository, tag) {
  const reference = await fetchJson(`https://api.github.com/repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`);
  if (reference.object?.type === "commit") return reference.object.sha;
  if (reference.object?.type !== "tag") throw new Error(`Unsupported tag object for ${repository}@${tag}`);
  const annotated = await fetchJson(`https://api.github.com/repos/${repository}/git/tags/${reference.object.sha}`);
  if (annotated.object?.type !== "commit") throw new Error(`Tag does not resolve to a commit: ${repository}@${tag}`);
  return annotated.object.sha;
}

async function verifyAsset(asset) {
  const response = await fetch(asset.browser_download_url, { headers: { "User-Agent": "vetta-cli-proxy-api-updater" } });
  if (!response.ok || !response.body) throw new Error(`Asset download failed (${response.status}): ${asset.name}`);
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 256 * 1024 * 1024) throw new Error(`Asset is too large: ${asset.name}`);
    hash.update(chunk);
  }
  const digest = hash.digest("hex");
  if (digest !== asset.digest.slice("sha256:".length)) throw new Error(`Digest mismatch: ${asset.name}`);
  if (asset.size !== undefined && size !== asset.size) throw new Error(`Size mismatch: ${asset.name}`);
}

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (!match) throw new Error(`Plugin version is not semver: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function nextMarketplaceVersion(current) {
  const now = new Date();
  const prefix = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, "0")}.${String(now.getUTCDate()).padStart(2, "0")}`;
  const match = new RegExp(`^${prefix.replaceAll(".", "\\.")}-(\\d+)$`, "u").exec(current);
  return `${prefix}-${match ? Number(match[1]) + 1 : 1}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

const [coreRelease, geminiRelease] = await Promise.all([
  latestStable(repositories.core),
  latestStable(repositories.gemini),
]);
const coreVersion = versionFromTag(coreRelease.tag_name);
const geminiVersion = versionFromTag(geminiRelease.tag_name);
const pluginPath = resolve(pluginDirectory, "plugin.json");
const plugin = await readJson(pluginPath);
const service = plugin.providers.services[0];
const runtimeLockPath = resolve(pluginDirectory, "runtime-lock.json");
const runtimeLock = await readJson(runtimeLockPath);
const currentRuntimeVersion = service.runtime.version;
const currentPlatforms = stableJson(runtimeLock.platforms);
const nextRuntimeVersion = `${coreVersion}+gemini.${geminiVersion}`;

const selectedAssets = [];
const nextPlatforms = {};
for (const [platform, names] of Object.entries(platforms)) {
  const core = assetBySuffix(coreRelease, "CLIProxyAPI", names.core);
  const gemini = assetBySuffix(geminiRelease, "gemini-cli", names.gemini);
  selectedAssets.push(core, gemini);
  nextPlatforms[platform] = [
    {
      url: core.browser_download_url,
      sha256: core.digest.slice("sha256:".length),
      archive: names.coreArchive,
      destination: "core",
    },
    {
      url: gemini.browser_download_url,
      sha256: gemini.digest.slice("sha256:".length),
      archive: "zip",
      destination: "plugins",
    },
  ];
  service.runtime.platforms[platform].artifacts = nextPlatforms[platform].map(({ url: _url, ...artifact }) => artifact);
}

console.log(`CLIProxyAPI: ${currentRuntimeVersion} -> ${nextRuntimeVersion}`);
if (currentRuntimeVersion === nextRuntimeVersion) {
  if (currentPlatforms !== stableJson(nextPlatforms)) throw new Error("Release assets changed without a version change; review the supply chain before changing the lock.");
  console.log("The marketplace lock already points at the latest stable runtime set.");
  process.exit(0);
}
if (!write) {
  console.log("Run with --write to verify all assets and update the marketplace package.");
  process.exitCode = 2;
  process.exit();
}

for (const asset of new Map(selectedAssets.map((asset) => [asset.id, asset])).values()) {
  console.log(`Verifying ${asset.name}`);
  await verifyAsset(asset);
}

const [coreRevision, geminiRevision] = await Promise.all([
  releaseCommit(repositories.core, coreRelease.tag_name),
  releaseCommit(repositories.gemini, geminiRelease.tag_name),
]);
const nextPluginVersion = bumpPatch(plugin.version);
service.runtime.version = nextRuntimeVersion;
plugin.version = nextPluginVersion;
await writeJson(pluginPath, plugin);
runtimeLock.version = nextRuntimeVersion;
runtimeLock.platforms = nextPlatforms;
await writeJson(runtimeLockPath, runtimeLock);

const packageJsonPath = resolve(pluginDirectory, "package.json");
const packageJson = await readJson(packageJsonPath);
packageJson.version = nextPluginVersion;
await writeJson(packageJsonPath, packageJson);

const abilityPath = resolve(pluginDirectory, "ability.json");
const ability = await readJson(abilityPath);
ability.version = nextPluginVersion;
await writeJson(abilityPath, ability);

const upstreamPath = resolve(pluginDirectory, "upstream.json");
const upstream = await readJson(upstreamPath);
const previousCoreVersion = upstream.core.version;
const previousGeminiVersion = upstream.providerPlugins["gemini-cli"].version;
upstream.core.version = coreVersion;
upstream.core.revision = coreRevision;
upstream.providerPlugins["gemini-cli"].version = geminiVersion;
upstream.providerPlugins["gemini-cli"].revision = geminiRevision;
if (previousGeminiVersion !== geminiVersion) delete upstream.providerPlugins["gemini-cli"].coreBuildVersion;
await writeJson(upstreamPath, upstream);

for (const name of ["detail.json", "detail.zh.json"]) {
  const path = resolve(pluginDirectory, name);
  const original = await readFile(path, "utf8");
  await writeFile(path, original.replaceAll(previousCoreVersion, coreVersion).replaceAll(previousGeminiVersion, geminiVersion));
}

const marketplacePath = resolve(root, ".vetta/marketplace.json");
const marketplace = await readJson(marketplacePath);
const catalogEntry = marketplace.abilities.find((candidate) => candidate.slug === "cli-proxy-api");
if (!catalogEntry) throw new Error("CLIProxyAPI marketplace entry is missing");
catalogEntry.version = nextPluginVersion;
marketplace.marketplaceVersion = nextMarketplaceVersion(marketplace.marketplaceVersion);
await writeJson(marketplacePath, marketplace);

console.log(`Updated plugin ${nextPluginVersion}; rebuild dist and run marketplace tests before opening a PR.`);
