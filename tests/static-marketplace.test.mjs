import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { prepareMarketplace } from '../scripts/static-marketplace.mjs';
import { publishMarketplace } from '../scripts/publish-marketplace.mjs';
import { publicationSettings } from '../scripts/marketplace.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'vetta-static-'));
  t.after(() => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); rmSync(root, { recursive: true }); });
  const put = (path, value) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value)); };
  const catalog = { schemaVersion: 3, name: 'test', repository: 'https://github.com/test/market', minAppVersion: '0.5.59', abilities: [
    { type: 'plugin', slug: 'demo', name: 'Demo', version: '1.0.0', minAppVersion: '0.5.59', source: { path: 'abilities/plugins/demo' } },
    { type: 'skill', slug: 'guide', name: 'Guide', version: '1.0.0', source: { path: 'abilities/skills/guide' } },
  ] };
  put('.vetta/marketplace.source.json', catalog);
  put('.vetta/publish.json', {
    sourceBranch: 'marketplace-source',
    distributionBranch: 'gh-pages',
    toolingCommit: 'a'.repeat(40),
    candidateAppCommits: { '0.5.59': 'b'.repeat(40) },
  });
  put('abilities/plugins/demo/plugin.json', { id: 'demo', name: 'Demo', version: '1.0.0', entry: 'dist/index.js', pluginApiVersion: '^2.0.0', permissions: [] });
  put('abilities/plugins/demo/ability.json', { schemaVersion: 1, type: 'plugin', slug: 'demo', version: '1.0.0' });
  put('abilities/plugins/demo/src/index.ts', 'development source');
  put('abilities/plugins/demo/dist/index.js', 'export default {}');
  put('abilities/plugins/demo/detail.json', { schemaVersion: 1, blocks: [] });
  put('abilities/skills/guide/SKILL.md', '---\nname: guide\ndescription: Guide\nversion: 1.0.0\n---\nUse the guide.');
  put('README.md', 'source repository');
  let builds = 0;
  const run = (name, previous) => prepareMarketplace({ root, output: join(root, name), previous, sourceSha: 'a'.repeat(40), buildPlugin: () => { builds++; }, date: '2026.09.19' });
  return { root, put, catalog, run, builds: () => builds };
}

test('publication settings accept only immutable App candidate commits', (t) => {
  const f = fixture(t);
  assert.deepEqual(publicationSettings(f.root).candidateAppCommits, { '0.5.59': 'b'.repeat(40) });
  f.put('.vetta/publish.json', {
    sourceBranch: 'marketplace-source',
    distributionBranch: 'gh-pages',
    toolingCommit: 'a'.repeat(40),
    candidateAppCommits: { '0.5.59': 'dev' },
  });
  assert.throws(() => publicationSettings(f.root), /full commit/);
});

test('publish, browse distribution, edit source, publish next version and retain compatible history', async (t) => {
  const f = fixture(t);
  const first = await f.run('first');
  assert.equal(first.packages.length, 1);
  assert.equal(f.builds(), 1);
  const manifest = JSON.parse(readFileSync(join(first.site, '.vetta/marketplace.json')));
  assert.equal(manifest.abilities[0].releases[0].version, '1.0.0');
  assert.equal(existsSync(join(first.site, 'abilities/plugins/demo/src')), false);
  assert.equal(existsSync(join(first.site, 'abilities/plugins/demo/plugin.json')), false);
  assert.equal(existsSync(join(first.site, 'README.md')), false);
  assert.ok(existsSync(join(first.site, 'abilities/skills/guide/SKILL.md')));
  const repeated = await f.run('repeated');
  assert.deepEqual(readFileSync(join(first.artifacts, 'demo-1.0.0.vettapkg')), readFileSync(join(repeated.artifacts, 'demo-1.0.0.vettapkg')));
  f.put('README.md', 'documentation changed');
  f.put('first/site/.git', 'gitdir: /runner/temporary-worktree');
  f.put('abilities/plugins/demo/src/index.ts', 'future work');
  const same = await f.run('same', first.site);
  assert.equal(same.changed, false);
  assert.equal(same.packages.length, 0);
  assert.equal(f.builds(), 2);
  f.catalog.abilities[0].version = '1.1.0';
  f.put('.vetta/marketplace.source.json', f.catalog);
  f.put('abilities/plugins/demo/plugin.json', { id: 'demo', name: 'Demo', version: '1.1.0', entry: 'dist/index.js', pluginApiVersion: '^2.0.0', permissions: [] });
  f.put('abilities/plugins/demo/ability.json', { schemaVersion: 1, type: 'plugin', slug: 'demo', version: '1.1.0' });
  const next = await f.run('next', first.site);
  const updated = JSON.parse(readFileSync(join(next.site, '.vetta/marketplace.json')));
  assert.deepEqual(updated.abilities[0].releases.map(x => x.version), ['1.0.0', '1.1.0']);
  assert.notEqual(updated.marketplaceVersion, manifest.marketplaceVersion);
  assert.equal(f.builds(), 3);
});

test('same-version Skill edits remain unpublished until its version advances', async (t) => {
  const f = fixture(t);
  const first = await f.run('first');
  f.put('abilities/skills/guide/SKILL.md', '---\nname: guide\ndescription: Guide\nversion: 1.0.0\n---\nFuture guide.');
  assert.equal((await f.run('same', first.site)).changed, false);
  f.catalog.abilities[1].version = '1.1.0';
  f.put('.vetta/marketplace.source.json', f.catalog);
  f.put('abilities/skills/guide/SKILL.md', '---\nname: guide\ndescription: Guide\nversion: 1.1.0\n---\nFuture guide.');
  const next = await f.run('next', first.site);
  assert.match(readFileSync(join(next.site, 'abilities/skills/guide/SKILL.md'), 'utf8'), /Future guide/);
});

test('rejects path traversal and a changed release declaration for an existing version', async (t) => {
  const f = fixture(t);
  const first = await f.run('first');
  f.catalog.abilities[0].minAppVersion = '0.5.60';
  f.put('.vetta/marketplace.source.json', f.catalog);
  await assert.rejects(f.run('bad', first.site), /new version/);
  f.catalog.abilities[0].source.path = '../outside';
  f.put('.vetta/marketplace.source.json', f.catalog);
  await assert.rejects(f.run('escape'), /Unsafe/);
});

for (const isPrivate of [false, true]) test(`interrupted ${isPrivate ? 'private' : 'public'} publication resumes without replacing bytes; only a verified index becomes visible`, async (t) => {
  const f = fixture(t);
  const git = (...args) => execFileSync('git', args, { cwd: f.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--initial-branch=marketplace-source');
  git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  git('commit', '--allow-empty', '-m', 'fixture');
  const sha = git('rev-parse', 'HEAD');
  const first = await f.run('first');
  f.put('first/publication.json', { ...first, sourceSha: sha, sourceBranch: 'marketplace-source', distributionBranch: 'gh-pages', previousCommit: null });
  let release, uploaded, visible, fail = true;
  const remoteReads = [];
  const gh = (...args) => {
    if (args[0] === 'api') {
      if (args[1] === 'repos/test/market') return JSON.stringify({ private: isPrivate });
      if (!release || release.draft) { const error = new Error('HTTP 404'); error.stderr = '404'; throw error; }
      return JSON.stringify(release);
    }
    if (args[1] === 'view') {
      if (!release) { const error = new Error('HTTP 404'); error.stderr = '404'; throw error; }
      return JSON.stringify({
        tagName: release.tag_name,
        isDraft: release.draft,
        targetCommitish: release.target_commitish,
        assets: release.assets.map(asset => ({ name: asset.name, apiUrl: asset.url })),
      });
    }
    if (args[1] === 'create') {
      assert.equal(release, undefined);
      uploaded = readFileSync(args[3]);
      release = { tag_name: first.packages[0].tag, draft: true, target_commitish: sha, assets: [{ name: first.packages[0].filename, url: 'https://api.github.com/repos/test/market/releases/assets/123' }] };
      if (fail) throw new Error('upload response lost');
      return '';
    }
    if (args[1] === 'download') { writeFileSync(join(args.at(-1), first.packages[0].filename), uploaded); return ''; }
    if (args[1] === 'edit') { release.draft = false; return ''; }
    throw new Error(`Unexpected GitHub operation: ${args}`);
  };
  const options = { root: f.root, directory: join(f.root, 'first'), gh, readRemote: name => { remoteReads.push(name); return name === 'gh-pages' ? null : sha; },
    verify: async () => {}, push: commit => { visible = commit; } };
  await assert.rejects(publishMarketplace(options), /response lost/);
  assert.equal(visible, undefined);
  fail = false;
  await publishMarketplace(options);
  assert.equal(release.draft, false);
  assert.ok(remoteReads.includes('marketplace-source'));
  assert.equal(remoteReads.includes('main'), false);
  const manifest = JSON.parse(git('show', `${visible}:.vetta/marketplace.json`));
  assert.equal(manifest.abilities[0].releases[0].artifact.sha256, first.packages[0].release.artifact.sha256);
  if (isPrivate) assert.equal(manifest.abilities[0].releases[0].artifact.url, 'https://api.github.com/repos/test/market/releases/assets/123');
  assert.doesNotMatch(git('ls-tree', '-r', '--name-only', visible), /src\/|scripts\/|\.vettapkg/);
  uploaded = Buffer.from('replaced package'); visible = undefined;
  await assert.rejects(publishMarketplace(options), /Published bytes differ/);
  assert.equal(visible, undefined);
  await assert.rejects(publishMarketplace({ ...options, readRemote: () => 'f'.repeat(40) }), /advanced/);
});
