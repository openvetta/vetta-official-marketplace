import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
export const writeJson = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); };
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const excluded = new Set(['.git', 'node_modules', '.vite', '__pycache__', 'test', 'tests', 'AGENTS.md', '.DS_Store']);

export function inside(root, path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes('\0') || path.split('/').some(x => !x || x === '.' || x === '..') || isAbsolute(path) || /^[A-Za-z]:/.test(path)) throw new Error(`Unsafe path: ${path}`);
  const target = resolve(root, path);
  const rel = relative(resolve(root), target);
  if (!rel || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Unsafe path: ${path}`);
  let cursor = resolve(root);
  for (const part of path.split('/')) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error(`Unsafe symlink: ${path}`);
  }
  return target;
}

export function files(root, include = () => true, prefix = '') {
  return readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => {
    const path = `${prefix}${entry.name}`;
    if (!include(path)) return [];
    if (entry.isSymbolicLink()) throw new Error(`Unsafe symlink: ${entry.name}`);
    if (entry.isDirectory()) return files(join(root, entry.name), include, `${path}/`).map(child => `${entry.name}/${child}`);
    if (!entry.isFile()) throw new Error(`Unsupported file: ${entry.name}`);
    return [entry.name];
  });
}

export function entries(catalog) {
  return catalog.abilities.flatMap(ability => [ability, ...(ability.type === 'bundle' ? ability.config.members.filter(x => x.source) : [])]);
}

export function sourceCatalog(root) {
  const catalog = readJson(join(root, '.vetta/marketplace.source.json'));
  if (catalog.schemaVersion !== 3 || !slugPattern.test(catalog.name) || !versionPattern.test(catalog.minAppVersion) || !Array.isArray(catalog.abilities) || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(catalog.repository)) throw new Error('Invalid marketplace source configuration');
  if ('marketplaceVersion' in catalog) throw new Error('marketplaceVersion is generated, not authored');
  const seen = new Map();
  for (const entry of entries(catalog)) {
    if (!slugPattern.test(entry.slug) || !['plugin', 'skill', 'mcp', 'bundle', 'scene'].includes(entry.type) || entry.releases) throw new Error(`Invalid source entry: ${entry.slug}`);
    if (!entry.source && entry.type === 'bundle') continue;
    const directory = inside(root, entry.source?.path);
    const identity = entry.version ? entry : readJson(join(directory, 'ability.json'));
    if (!identity.version || identity.slug !== entry.slug || identity.type !== entry.type) throw new Error(`Identity mismatch: ${entry.slug}`);
    const previous = seen.get(entry.slug);
    if (previous && (previous.type !== entry.type || previous.source.path !== entry.source.path || previous.minAppVersion !== entry.minAppVersion)) throw new Error(`Conflicting identity: ${entry.slug}`);
    seen.set(entry.slug, entry);
    const presentationPath = join(directory, 'ability.json');
    if (existsSync(presentationPath)) {
      const presentation = readJson(presentationPath);
      if (presentation.type !== entry.type || presentation.slug !== entry.slug || presentation.version !== identity.version) throw new Error(`Presentation identity mismatch: ${entry.slug}`);
    }
    if (entry.type === 'plugin') {
      const descriptor = readJson(join(directory, 'plugin.json'));
      if (descriptor.id !== entry.slug || descriptor.version !== identity.version || !versionPattern.test(descriptor.version) || !versionPattern.test(entry.minAppVersion)) throw new Error(`Plugin identity or minAppVersion mismatch: ${entry.slug}`);
      if (compareVersion(entry.minAppVersion, catalog.minAppVersion) < 0) throw new Error(`Plugin minimum is below the catalog reader minimum: ${entry.slug}`);
    } else if (entry.type === 'mcp') {
      const descriptor = readJson(join(directory, 'mcp.json'));
      if (descriptor.slug !== entry.slug || descriptor.version !== identity.version || entry.config) throw new Error(`MCP identity or configuration mismatch: ${entry.slug}`);
    } else if (entry.type === 'skill' || entry.type === 'scene') {
      const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(directory, 'SKILL.md'), 'utf8'))?.[1] ?? '';
      const scalar = key => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(header)?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
      if (scalar('name') !== entry.slug || scalar('version') !== identity.version || !scalar('description')) throw new Error(`Skill identity mismatch: ${entry.slug}`);
    }
  }
  return catalog;
}

function copyPackage(from, to, presentationOnly) {
  const resources = new Set(['ability.json']);
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && ['path', 'fallback', 'icon', 'src', 'brand_icon_url'].includes(key) && !/^(?:https?:|solar:)/.test(item)) {
        const path = inside(from, item);
        if (!resources.has(item)) {
          resources.add(item);
          if (item.endsWith('.json') && existsSync(path)) inspect(readJson(path));
        }
      } else if (typeof item === 'object') inspect(item);
    }
  };
  if (presentationOnly && existsSync(join(from, 'ability.json'))) inspect(readJson(join(from, 'ability.json')));
  const include = path => {
    const parts = path.split('/');
    if (parts.some(x => excluded.has(x) || x.startsWith('.env'))) return false;
    return !presentationOnly || [...resources].some(item => item === path || item.startsWith(`${path}/`)) || parts[0] === 'assets' || parts.length === 1 && (/^detail.*\.json$/.test(path) || /\.md$/.test(path) || /^LICENSE/.test(path));
  };
  for (const path of files(from, include)) {
    const target = inside(to, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(inside(from, path)));
  }
}

function compareVersion(a, b) {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function treeDigest(root, manifest) {
  const { marketplaceVersion, ...content } = manifest;
  const hash = createHash('sha256').update(JSON.stringify(content));
  for (const path of files(root, path => path !== '.git').filter(x => !x.startsWith('.vetta/') && x !== '.nojekyll')) hash.update(path).update('\0').update(readFileSync(join(root, path)));
  return hash.digest('hex');
}

function nextVersion(current, date) {
  const match = /^(\d{4}\.\d{2}\.\d{2})-(\d+)$/.exec(current ?? '');
  if (!match || date > match[1]) return `${date}-1`;
  return `${match[1]}-${Number(match[2]) + 1}`;
}

export async function prepareMarketplace({ root, output, previous, sourceSha, buildPlugin, date = new Date().toISOString().slice(0, 10).replaceAll('-', '.') }) {
  if (existsSync(output)) throw new Error(`Output already exists: ${output}`);
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('A fixed source commit is required');
  const catalog = sourceCatalog(root);
  const old = previous && existsSync(join(previous, '.vetta/marketplace.json')) ? readJson(join(previous, '.vetta/marketplace.json')) : undefined;
  if (old && old.repository !== catalog.repository) throw new Error('Published repository identity differs');
  const oldEntries = new Map(old ? entries(old).map(x => [x.slug, x]) : []);
  const site = join(output, 'site'), artifacts = join(output, 'artifacts');
  mkdirSync(site, { recursive: true });
  mkdirSync(artifacts, { recursive: true });
  const packages = [], resolved = new Map();
  for (const entry of entries(catalog)) {
    if (!entry.source) continue;
    const source = inside(root, entry.source.path);
    const identity = entry.version ? entry : readJson(join(source, 'ability.json'));
    const oldEntry = oldEntries.get(entry.slug);
    const target = inside(site, entry.source.path);
    if (entry.type === 'plugin') {
      if (resolved.has(entry.slug)) { entry.releases = resolved.get(entry.slug); delete entry.minAppVersion; continue; }
      const descriptor = readJson(join(source, 'plugin.json'));
      const releases = structuredClone(oldEntry?.releases ?? []);
      const existing = releases.find(x => x.version === descriptor.version);
      if (existing) {
        if (existing.minAppVersion !== entry.minAppVersion || existing.pluginApiVersion !== descriptor.pluginApiVersion || JSON.stringify(existing.permissions) !== JSON.stringify(descriptor.permissions ?? []) || JSON.stringify(existing.commands) !== JSON.stringify(descriptor.commands ?? [])) throw new Error(`Changed release declaration for ${entry.slug}; publish a new version`);
      } else {
        if (releases.some(x => compareVersion(x.version, descriptor.version) >= 0)) throw new Error(`New version must advance: ${entry.slug}`);
        await buildPlugin(source);
        const python = process.env.VETTA_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
        const packager = fileURLToPath(new URL('./stage-plugin-release.py', import.meta.url));
        const release = JSON.parse(execFileSync(python, [packager, entry.slug, '--root', root, '--min-app-version', entry.minAppVersion, '--output-dir', artifacts], { encoding: 'utf8' }));
        releases.push(release);
        packages.push({ slug: entry.slug, release, filename: `${entry.slug}-${descriptor.version}.vettapkg`, tag: `plugin-${entry.slug}-${descriptor.version}` });
      }
      entry.releases = releases.sort((a, b) => compareVersion(a.version, b.version));
      if (entry.version) entry.version = entry.releases.at(-1).version;
      delete entry.minAppVersion;
      resolved.set(entry.slug, entry.releases);
      copyPackage(source, target, true);
    } else {
      const oldSource = previous && oldEntry?.source && inside(previous, oldEntry.source.path);
      const oldVersion = oldEntry?.version ?? (oldSource && existsSync(join(oldSource, 'ability.json')) ? readJson(join(oldSource, 'ability.json')).version : undefined);
      // Non-plugin runtime content is already installable; preserve its published bytes until a version bump.
      const reuse = oldSource && existsSync(oldSource) && oldVersion === identity.version;
      copyPackage(reuse ? oldSource : source, target, false);
      if (reuse && entry.type === 'bundle') {
        const authored = value => JSON.stringify(value, (key, item) => ['releases', 'minAppVersion'].includes(key) ? undefined : item);
        if (authored(entry.config) !== authored(oldEntry.config)) throw new Error(`Bundle configuration changed: ${entry.slug}; publish a new version`);
      }
    }
  }
  // Bundle references may reuse the same plugin; all occurrences use the resolved immutable history.
  for (const entry of entries(catalog)) if (entry.type === 'plugin' && resolved.has(entry.slug)) entry.releases = resolved.get(entry.slug);
  const contentHash = treeDigest(site, catalog);
  const unchanged = previous && old && contentHash === treeDigest(previous, old);
  catalog.marketplaceVersion = unchanged ? old.marketplaceVersion : nextVersion(old?.marketplaceVersion, date);
  writeJson(join(site, '.vetta/marketplace.json'), catalog);
  writeFileSync(join(site, '.nojekyll'), '');
  const result = { site, artifacts, changed: !unchanged, sourceSha, previousVersion: old?.marketplaceVersion ?? null, packages };
  writeJson(join(output, 'publication.json'), result);
  return result;
}
