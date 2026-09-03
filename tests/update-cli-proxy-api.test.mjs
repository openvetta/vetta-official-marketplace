import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const execute = promisify(execFile);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("upstream updater verifies a mocked release and synchronizes all source versions without real network", async () => {
  const root = await mkdtemp(join(tmpdir(), "vetta-upstream-update-"));
  try {
    const relativePlugin = "abilities/plugins/cli-proxy-api";
    await mkdir(join(root, relativePlugin), { recursive: true });
    await mkdir(join(root, "scripts"));
    await mkdir(join(root, ".vetta"));
    for (const path of ["scripts/update-cli-proxy-api.mjs", ".vetta/marketplace.json", ...["plugin.json", "package.json", "ability.json", "upstream.json", "detail.json", "detail.zh.json"].map((file) => `${relativePlugin}/${file}`)]) {
      await copyFile(join(repository, path), join(root, path));
    }
    const upstream = JSON.parse(await readFile(join(root, relativePlugin, "upstream.json"), "utf8"));
    const bump = (version) => { const values = version.split(".").map(Number); values[2] += 1; return values.join("."); };
    const core = bump(upstream.core.version);
    const gemini = bump(upstream.providerPlugins["gemini-cli"].version);
    const shim = join(root, "mock-fetch.mjs");
    await writeFile(shim, `
      import { createHash } from 'node:crypto';
      const core = ${JSON.stringify(core)}, gemini = ${JSON.stringify(gemini)};
      const payload = Buffer.from('verified-fixture-archive');
      const digest = 'sha256:' + createHash('sha256').update(payload).digest('hex');
      let id = 0;
      globalThis.fetch = async (url) => {
        if (url.includes('/git/ref/tags/')) return Response.json({object:{type:'commit',sha:'a'.repeat(40)}});
        if (url.includes('/releases?')) {
          const isCore = url.includes('/CLIProxyAPI/');
          const version = isCore ? core : gemini;
          const prefix = isCore ? 'CLIProxyAPI' : 'gemini-cli';
          const repo = isCore ? 'CLIProxyAPI' : 'cpa-plugin-gemini-cli';
          const platforms = isCore ? ['windows_amd64.zip','windows_aarch64.zip','darwin_amd64.tar.gz','darwin_aarch64.tar.gz','linux_amd64.tar.gz','linux_aarch64.tar.gz'] : ['windows_amd64.zip','windows_arm64.zip','darwin_amd64.zip','darwin_arm64.zip','linux_amd64.zip','linux_arm64.zip'];
          return Response.json([{tag_name:'v'+version,draft:false,prerelease:false,assets:platforms.map((platform) => {
            const name = prefix+'_'+version+'_'+platform;
            return {id:++id,name,digest,size:payload.length,browser_download_url:'https://github.com/router-for-me/'+repo+'/releases/download/v'+version+'/'+name};
          })}]);
        }
        if (url.startsWith('https://github.com/router-for-me/')) return new Response(payload);
        throw new Error('Unexpected network request in updater test');
      };
    `);
    const result = await execute(process.execPath, ["--import", pathToFileURL(shim).href, join(root, "scripts/update-cli-proxy-api.mjs"), "--write"], { cwd: root });
    assert.match(result.stdout, /Updated plugin/u);
    const updatedPlugin = JSON.parse(await readFile(join(root, relativePlugin, "plugin.json"), "utf8"));
    assert.equal(updatedPlugin.providers.services[0].runtime.version, `${core}+gemini.${gemini}`);
    const catalog = JSON.parse(await readFile(join(root, ".vetta/marketplace.json"), "utf8"));
    assert.equal(catalog.abilities.find((ability) => ability.slug === "cli-proxy-api").version, updatedPlugin.version);
    for (const file of ["detail.json", "detail.zh.json"]) {
      const detail = await readFile(join(root, relativePlugin, file), "utf8");
      assert.ok(detail.includes(core));
      assert.ok(detail.includes(gemini));
      assert.ok(!detail.includes(upstream.core.version));
    }
    const updatedUpstream = JSON.parse(await readFile(join(root, relativePlugin, "upstream.json"), "utf8"));
    assert.equal(updatedUpstream.providerPlugins["gemini-cli"].revision, "a".repeat(40));
    assert.equal(updatedUpstream.providerPlugins["gemini-cli"].coreBuildVersion, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
