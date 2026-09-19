import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest, files, inside, readJson, writeJson } from './static-marketplace.mjs';

export function assertExistingRelease(item, bytes) {
  if (digest(bytes) !== item.release.artifact.sha256) throw new Error(`Published bytes differ for ${item.slug}; use a new version`);
}

// All writes are confined to immutable release assets and the generated distribution branch.
export async function publishMarketplace({ root, directory, gh = (...args) => execFileSync('gh', args, { cwd: root, encoding: 'utf8' }).trim(), verify, readRemote, push }) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  readRemote ??= branch => git('ls-remote', 'origin', `refs/heads/${branch}`).split(/\s/)[0] || null;
  push ??= commit => git('push', 'origin', `${commit}:refs/heads/gh-pages`);
  const publication = readJson(join(directory, 'publication.json'));
  const source = readJson(join(root, '.vetta/marketplace.source.json'));
  const catalogPath = join(directory, 'site/.vetta/marketplace.json');
  const catalog = readJson(catalogPath);
  if (source.repository !== catalog.repository || git('rev-parse', 'HEAD') !== publication.sourceSha) throw new Error('Candidate source identity differs');
  const repository = new URL(source.repository).pathname.slice(1);
  const branch = process.env.GITHUB_REF_NAME ?? 'main';
  if (readRemote(branch) !== publication.sourceSha) throw new Error('Source branch advanced; rerun the latest revision');
  const remote = readRemote('gh-pages');
  if (remote !== publication.previousCommit) throw new Error('Distribution advanced; rebuild against the latest gh-pages');
  if (!publication.changed) return { published: false };
  await verify(directory);
  for (const item of publication.packages) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(item.slug) || item.tag !== `plugin-${item.slug}-${item.release.version}` || item.filename !== `${item.slug}-${item.release.version}.vettapkg`) throw new Error('Invalid publication package');
    const archive = inside(join(directory, 'artifacts'), item.filename);
    assertExistingRelease(item, readFileSync(archive));
    let release;
    try { release = JSON.parse(gh('api', `repos/${repository}/releases/tags/${item.tag}`)); }
    catch (error) { if (!String(error.stderr ?? error.message).includes('404')) throw error; }
    if (!release) {
      gh('release', 'create', item.tag, archive, '--repo', repository, '--draft', '--target', publication.sourceSha, '--title', `${item.slug} ${item.release.version}`, '--notes', `Built from ${publication.sourceSha}.`);
      release = JSON.parse(gh('api', `repos/${repository}/releases/tags/${item.tag}`));
    }
    const asset = release.assets.find(x => x.name === item.filename);
    if (!asset) {
      if (!release.draft || release.target_commitish !== publication.sourceSha) throw new Error(`Incomplete existing release: ${item.tag}`);
      gh('release', 'upload', item.tag, archive, '--repo', repository);
    }
    const download = mkdtempSync(join(tmpdir(), 'vetta-release-verify-'));
    try {
      gh('release', 'download', item.tag, '--repo', repository, '--pattern', item.filename, '--dir', download);
      assertExistingRelease(item, readFileSync(join(download, item.filename)));
    } finally { rmSync(download, { recursive: true, force: true }); }
    if (release.draft) gh('release', 'edit', item.tag, '--repo', repository, '--draft=false', '--latest=false');
  }
  // Private repositories use authenticated asset API URLs; public repositories keep readable download URLs.
  const isPrivate = JSON.parse(gh('api', `repos/${repository}`)).private;
  if (isPrivate) {
    for (const entry of catalog.abilities.flatMap(x => [x, ...(x.type === 'bundle' ? x.config.members : [])])) {
      for (const record of entry.releases ?? []) {
        if (!record.artifact.url.startsWith(`${source.repository}/releases/download/`)) continue;
        const parts = new URL(record.artifact.url).pathname.split('/');
        const release = JSON.parse(gh('api', `repos/${repository}/releases/tags/${parts.at(-2)}`));
        const asset = release.assets.find(x => x.name === decodeURIComponent(parts.at(-1)));
        if (!asset) throw new Error('Published asset is missing');
        record.artifact.url = asset.url;
      }
    }
    writeJson(catalogPath, catalog);
  }
  // Check the public/authenticated download paths before making the index discoverable.
  await verify(directory, true);
  const site = join(directory, 'site');
  const index = join(mkdtempSync(join(tmpdir(), 'vetta-index-')), 'index');
  const env = { ...process.env, GIT_INDEX_FILE: index };
  const indexedGit = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  indexedGit('read-tree', '--empty');
  for (const path of files(site)) {
    const object = git('hash-object', '-w', '--no-filters', inside(site, path));
    indexedGit('update-index', '--add', '--cacheinfo', '100644', object, path);
  }
  const tree = indexedGit('write-tree');
  const commit = git('commit-tree', tree, ...(remote ? ['-p', remote] : []), '-m', `chore(marketplace): 发布 ${catalog.marketplaceVersion}\n\n从已审核源码 ${publication.sourceSha} 生成市场索引。`);
  try { push(commit); } finally { rmSync(resolve(index, '..'), { recursive: true, force: true }); }
  return { published: true, commit };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = process.cwd(), directory = resolve(process.argv[2] ?? '.marketplace-build');
  const tooling = resolve('.tooling/open-vetta');
  const { verifyCandidate } = await import('./marketplace.mjs');
  const { verifyMarketplacePublication } = await import(pathToFileURL(join(tooling, 'scripts/release/check-plugin-marketplace-publication.mjs')).href);
  publishMarketplace({ root, directory, verify: (dir, remote) => remote
    ? verifyMarketplacePublication(readJson(join(dir, 'site/.vetta/marketplace.json')), { token: process.env.GITHUB_TOKEN })
    : verifyCandidate(dir, tooling),
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
