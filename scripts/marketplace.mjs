import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareMarketplace, readJson, sourceCatalog, writeJson, digest, inside } from './static-marketplace.mjs';

const root = process.cwd();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const branchPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._/-]*[A-Za-z0-9])?$/;

export function publicationSettings(directory) {
  const settings = readJson(join(directory, '.vetta/publish.json'));
  const validBranch = value => typeof value === 'string' && branchPattern.test(value) && !value.includes('..') && !value.includes('//') && !value.includes('@{');
  if (!validBranch(settings.sourceBranch)) throw new Error('Configure a valid sourceBranch for reviewed source changes');
  if (settings.distributionBranch !== 'gh-pages' || settings.sourceBranch === settings.distributionBranch) throw new Error('Use gh-pages only for generated distribution content');
  if (!/^[a-f0-9]{40}$/.test(settings.toolingCommit)) throw new Error('Pin the publication tool to a full commit');
  settings.candidateAppCommits ??= {};
  if (!settings.candidateAppCommits || typeof settings.candidateAppCommits !== 'object' || Array.isArray(settings.candidateAppCommits)) throw new Error('candidateAppCommits must map App versions to full commits');
  for (const [version, commit] of Object.entries(settings.candidateAppCommits)) {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Pin each candidate App version to a full commit');
  }
  return settings;
}

export async function verifyCandidate(directory, tooling) {
  const settings = publicationSettings(root);
  const manifest = readJson(join(directory, 'site/.vetta/marketplace.json'));
  const { syncMarketplaceIndex } = await import(pathToFileURL(join(tooling, 'packages/plugins/plugin-cli/src/sync.ts')).href);
  const reconciliation = syncMarketplaceIndex({ hubRoot: join(directory, 'site'), manifestPath: join(directory, 'site/.vetta/marketplace.json'), apply: false });
  if (reconciliation.problems.length || reconciliation.changes.length) throw new Error(`Distribution reconciliation failed: ${JSON.stringify(reconciliation)}`);
  const publication = readJson(join(directory, 'publication.json'));
  const artifacts = new Map(publication.packages.map(item => [item.release.artifact.url, item]));
  const { verifyMarketplacePublication } = await import(pathToFileURL(join(tooling, 'scripts/release/check-plugin-marketplace-publication.mjs')).href);
  await verifyMarketplacePublication(manifest, {
    token: process.env.GITHUB_TOKEN,
    candidateAppCommits: settings.candidateAppCommits,
    fetcher: async (url, init) => {
      const item = artifacts.get(String(url));
      if (!item) return fetch(url, init);
      const bytes = readFileSync(inside(join(directory, 'artifacts'), item.filename));
      if (digest(bytes) !== item.release.artifact.sha256) throw new Error(`Candidate digest mismatch: ${item.slug}`);
      return new Response(bytes);
    },
  });
}

async function main() {
  const command = process.argv[2];
  if (command === 'check') {
    const catalog = sourceCatalog(root);
    publicationSettings(root);
    console.log(`Validated source entries for ${catalog.name}`);
    return;
  }
  if (command === 'verify') {
    await verifyCandidate(resolve(option('--output') ?? '.marketplace-build'), resolve(option('--tooling') ?? '.tooling/open-vetta'));
    return;
  }
  if (command !== 'build') throw new Error('Usage: node scripts/marketplace.mjs check|build|verify [--output DIR] [--previous DIR] [--tooling DIR]');
  const settings = publicationSettings(root);
  const previous = option('--previous');
  const output = resolve(option('--output') ?? '.marketplace-build');
  const result = await prepareMarketplace({
    root, output, previous: previous && resolve(previous), sourceSha: git('rev-parse', 'HEAD'),
    buildPlugin: directory => {
      const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
      for (const args of [['ci'], ['run', 'check', '--if-present'], ['test', '--if-present'], ['run', 'build']]) {
        if (process.platform === 'win32') execFileSync(process.execPath, [npmCli, ...args], { cwd: directory, stdio: 'inherit' });
        else execFileSync('npm', args, { cwd: directory, stdio: 'inherit' });
      }
    },
  });
  const branch = settings.distributionBranch;
  result.sourceBranch = settings.sourceBranch;
  result.distributionBranch = branch;
  result.previousCommit = previous ? git('rev-parse', `refs/remotes/origin/${branch}`) : null;
  writeJson(join(output, 'publication.json'), result);
  console.log(`Prepared ${result.packages.length} new packages; distribution changed: ${result.changed}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error.message); process.exitCode = 1; });
