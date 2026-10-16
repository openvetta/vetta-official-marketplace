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

test("upstream updater preserves the pending release version across runtime updates", async () => {
  const root = await mkdtemp(join(tmpdir(), "vetta-upstream-update-"));
  try {
    const relativePlugin = "abilities/plugins/cli-proxy-api";
    await mkdir(join(root, relativePlugin), { recursive: true });
    await mkdir(join(root, "scripts"));
    await mkdir(join(root, ".vetta"));
    for (const path of ["scripts/update-cli-proxy-api.mjs", "scripts/cli-proxy-api-release-policy.mjs", ".vetta/marketplace.source.json", ...["plugin.json", "runtime-lock.json", "package.json", "package-lock.json", "ability.json", "upstream.json", "detail.json", "detail.zh.json"].map((file) => `${relativePlugin}/${file}`)]) {
      await copyFile(join(repository, path), join(root, path));
    }
    const identityPaths = [".vetta/marketplace.source.json", ...["package.json", "package-lock.json", "ability.json"].map((file) => `${relativePlugin}/${file}`)];
    const identityBefore = new Map(await Promise.all(identityPaths.map(async (path) => [path, await readFile(join(root, path), "utf8")])));
    const originalPluginVersion = JSON.parse(await readFile(join(root, relativePlugin, "plugin.json"), "utf8")).version;
    const upstream = JSON.parse(await readFile(join(root, relativePlugin, "upstream.json"), "utf8"));
    const bump = (version) => { const values = version.split(".").map(Number); values[2] += 1; return values.join("."); };
    const core = bump(upstream.core.version);
    const shim = join(root, "mock-fetch.mjs");
    await writeFile(shim, `
      import { createHash } from 'node:crypto';
      const core = process.env.CPA_TEST_CORE_VERSION || ${JSON.stringify(core)};
      const payload = Buffer.from('verified-fixture-archive');
      const digest = 'sha256:' + createHash('sha256').update(payload).digest('hex');
      let id = 0;
      globalThis.fetch = async (url) => {
        if (!url.includes('/CLIProxyAPI/')) throw new Error('Unexpected repository in updater test: ' + url);
        if (url.includes('/git/ref/tags/')) return Response.json({object:{type:'commit',sha:'a'.repeat(40)}});
        if (url.includes('/releases?') || url.includes('/releases/tags/')) {
          const platforms = ['windows_amd64.zip','windows_aarch64.zip','darwin_amd64.tar.gz','darwin_aarch64.tar.gz','linux_amd64.tar.gz','linux_aarch64.tar.gz'];
          const release = {tag_name:'v'+core,draft:false,prerelease:false,assets:platforms.map((platform) => {
            const name = 'CLIProxyAPI_'+core+'_'+platform;
            return {id:++id,name,digest,size:payload.length,browser_download_url:'https://github.com/router-for-me/CLIProxyAPI/releases/download/v'+core+'/'+name};
          })};
          return Response.json(url.includes('/releases/tags/') ? release : [release]);
        }
        if (url.startsWith('https://github.com/router-for-me/CLIProxyAPI/')) return new Response(payload);
        throw new Error('Unexpected network request in updater test');
      };
    `);
    const result = await execute(process.execPath, ["--import", pathToFileURL(shim).href, join(root, "scripts/update-cli-proxy-api.mjs"), "--write"], { cwd: root });
    assert.match(result.stdout, /Updated runtime lock; plugin version remains/u);
    for (const [path, before] of identityBefore) assert.equal(await readFile(join(root, path), "utf8"), before, `Updater changed release identity file: ${path}`);
    const updatedPlugin = JSON.parse(await readFile(join(root, relativePlugin, "plugin.json"), "utf8"));
    assert.equal(updatedPlugin.version, originalPluginVersion);
    const packageLock = JSON.parse(await readFile(join(root, relativePlugin, "package-lock.json"), "utf8"));
    assert.equal(packageLock.version, updatedPlugin.version);
    assert.equal(packageLock.packages[""].version, updatedPlugin.version);
    assert.equal(updatedPlugin.providers.services[0].runtime.version, core);
    const runtimeLock = JSON.parse(await readFile(join(root, relativePlugin, "runtime-lock.json"), "utf8"));
    assert.equal(runtimeLock.version, core);
    assert.equal(runtimeLock.platforms["win32-x64"].length, 1);
    assert.equal(runtimeLock.platforms["win32-x64"][0].destination, "core");
    assert.match(runtimeLock.platforms["win32-x64"][0].url, /^https:\/\/github\.com\/router-for-me\/CLIProxyAPI\//u);
    assert.equal(updatedPlugin.providers.services[0].runtime.platforms["win32-x64"].artifacts.length, 1);
    assert.equal(updatedPlugin.providers.services[0].runtime.platforms["win32-x64"].artifacts[0].url, undefined);
    const catalog = JSON.parse(await readFile(join(root, ".vetta/marketplace.source.json"), "utf8"));
    assert.equal(catalog.abilities.find((ability) => ability.slug === "cli-proxy-api").version, updatedPlugin.version);
    for (const file of ["detail.json", "detail.zh.json"]) {
      const detail = await readFile(join(root, relativePlugin, file), "utf8");
      assert.ok(detail.includes(core));
      assert.ok(!detail.includes(upstream.core.version));
    }
    const updatedUpstream = JSON.parse(await readFile(join(root, relativePlugin, "upstream.json"), "utf8"));
    assert.equal(updatedUpstream.core.revision, "a".repeat(40));
    assert.equal(updatedUpstream.providerPlugins, undefined);

    const command = ["--import", pathToFileURL(shim).href, join(root, "scripts/update-cli-proxy-api.mjs")];
    const pinned = await execute(process.execPath, [...command, "--core-version", core], { cwd: root });
    assert.match(pinned.stdout, /already points/u);
    const before = await readFile(join(root, relativePlugin, "plugin.json"), "utf8");
    await assert.rejects(execute(process.execPath, [...command, "--write"], {
      cwd: root, env: { ...process.env, CPA_TEST_CORE_VERSION: `${Number(core.split(".")[0]) + 1}.0.0` },
    }), /major upgrade requires compatibility review/u);
    assert.equal(await readFile(join(root, relativePlugin, "plugin.json"), "utf8"), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
