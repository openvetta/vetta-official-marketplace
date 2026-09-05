import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const catalog = readJson(resolve(root, ".vetta/marketplace.json"));
const bySlug = new Map(catalog.abilities.map((ability) => [ability.slug, ability]));

// Inspect only explicitly referenced packages; an unrelated directory is not a catalog entry.
for (const bundle of catalog.abilities.filter((ability) => ability.type === "bundle")) {
  for (const member of bundle.config.members) {
    if (!member.source) continue;
    assert.equal(catalog.schemaVersion, 2);
    const descriptor = readJson(packageFile(root, `${member.source.path}/ability.json`));
    assert.equal(descriptor.type, member.type);
    assert.equal(descriptor.slug, member.slug);
    if (bySlug.has(member.slug)) {
      assert.equal(bySlug.get(member.slug).source.path, member.source.path);
    } else {
      assert.equal("config" in descriptor, false);
      assert.equal("source" in descriptor, false);
      bySlug.set(member.slug, { ...descriptor, source: member.source });
    }
  }
}

function packageFile(directory, path) {
  assert.equal(typeof path, "string");
  const target = resolve(directory, path);
  const rel = relative(directory, target);
  assert.ok(rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`), path);
  assert.ok(existsSync(target), `Missing package resource: ${path}`);
  assert.equal(lstatSync(target).isSymbolicLink(), false, path);
  return target;
}

test("catalog identities are unique and display names do not contain ability types", () => {
  assert.equal(new Set(catalog.abilities.map((ability) => ability.slug)).size, catalog.abilities.length);
  for (const ability of bySlug.values()) {
    const names = [ability.name, ...Object.values(ability.detail?.i18n ?? {}).map((locale) => locale.name)];
    for (const name of names) {
      assert.ok(name?.trim(), ability.slug);
      assert.doesNotMatch(name, /\b(?:mcp|skill|plugin|bundle)\b|技能|插件|套装/iu, ability.slug);
    }
  }
});

test("categorized entries have consistent Chinese and English group labels", () => {
  const labels = new Map();
  for (const ability of bySlug.values()) {
    if (!ability.category) continue;
    assert.ok(ability.categoryI18n?.zh?.trim(), ability.slug);
    assert.ok(ability.categoryI18n?.en?.trim(), ability.slug);
    if (labels.has(ability.category)) {
      assert.deepEqual(ability.categoryI18n, labels.get(ability.category));
    }
    labels.set(ability.category, ability.categoryI18n);
  }
});

for (const ability of bySlug.values()) {
  test(`${ability.slug}: package identity and bilingual presentation resources match the catalog`, () => {
    const directory = packageFile(root, ability.source.path);
    const presentation = readJson(packageFile(directory, "ability.json"));
    for (const field of ["slug", "type", "version"]) {
      assert.equal(presentation[field], ability[field], field);
    }
    assert.ok(ability.detail?.i18n?.zh?.description?.trim());
    const detail = presentation.detail;
    assert.ok(detail.i18n?.zh?.path);
    for (const source of [detail, ...Object.values(detail.i18n)]) {
      const path = packageFile(directory, source.path);
      if ((source.format ?? detail.format) === "blocks") {
        const document = readJson(path);
        assert.equal(document.schemaVersion, 1);
        assert.ok(document.blocks.length > 0);
      } else {
        assert.ok(readFileSync(path, "utf8").trim());
      }
      if (source.fallback) packageFile(directory, source.fallback);
    }
    if (!/^(?:solar:|https:\/\/)/.test(presentation.icon)) {
      packageFile(directory, presentation.icon);
    }
    if (ability.type === "mcp") {
      assert.equal("config" in ability, false);
      const mcp = readJson(packageFile(directory, "mcp.json"));
      assert.equal(mcp.slug, ability.slug);
      assert.equal(mcp.version, ability.version);
    }
    if (ability.type === "skill") {
      const skill = readFileSync(packageFile(directory, "SKILL.md"), "utf8");
      const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1];
      assert.ok(frontmatter);
      const scalar = (key) => frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "mu"))?.[1]
        .trim().replace(/^(["'])(.*)\1$/u, "$2");
      assert.equal(scalar("name"), ability.slug);
      assert.equal(scalar("version"), ability.version);
    }
  });
}

test("bundles resolve distinct, separately installable packages without requiring independent listings", () => {
  for (const bundle of catalog.abilities.filter((ability) => ability.type === "bundle")) {
    const seen = new Set();
    assert.ok(bundle.config.members.length > 0);
    for (const member of bundle.config.members) {
      assert.ok(["skill", "mcp", "plugin"].includes(member.type));
      assert.equal(bySlug.get(member.slug)?.type, member.type);
      assert.equal(seen.has(member.slug), false);
      seen.add(member.slug);
    }
  }
});

test("Feishu provides the official CLI lifecycle without adding an Action, MCP server or Agent tool", () => {
  const ability = bySlug.get("feishu");
  assert.equal(ability?.type, "plugin");
  const directory = packageFile(root, ability.source.path);
  const plugin = readJson(packageFile(directory, "plugin.json"));
  assert.deepEqual(plugin.providers, {
    cli: [{
      id: "lark-cli",
      command: "lark-cli",
      probe: { args: ["--version"], timeoutMs: 10000 },
      install: {
        command: "npx",
        args: ["-y", "@larksuite/cli@latest", "install"],
        timeoutMs: 600000,
      },
    }],
  });
  assert.equal("commands" in plugin, false);
  assert.equal("mcpServers" in plugin, false);
  assert.equal("tools" in plugin.agent, false);
  assert.ok(plugin.permissions.includes("ui.slot.ability-detail"));

  const skill = readFileSync(packageFile(directory, "agent/skills/feishu/SKILL.md"), "utf8");
  assert.match(skill, /lark-cli skills list/u);
  assert.match(skill, /lark-cli skills read <skill-name>/u);
  assert.match(skill, /existing shell/u);
  assert.match(skill, /Do not invent a Vetta tool or MCP layer/u);

  for (const detailPath of ["detail.json", "detail.zh.json"]) {
    const text = JSON.stringify(readJson(packageFile(directory, detailPath)));
    assert.match(text, /lark-cli/u);
    assert.match(text, /QR|二维码/u);
    assert.match(text, /Secret/u);
  }
});

test("CLIProxyAPI keeps service-specific behavior in the marketplace plugin and pins a six-platform runtime set", () => {
  const ability = bySlug.get("cli-proxy-api");
  assert.equal(ability?.type, "plugin");
  assert.equal(catalog.minAppVersion, "0.5.50");
  const directory = packageFile(root, ability.source.path);
  const presentation = readJson(packageFile(directory, "ability.json"));
  assert.equal(presentation.icon, "assets/icon.png");
  const icon = readFileSync(packageFile(directory, presentation.icon));
  assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const plugin = readJson(packageFile(directory, "plugin.json"));
  assert.equal(plugin.pluginApiVersion, "^1.5.0");
  assert.deepEqual(plugin.permissions.sort(), ["models.manage", "network.fetch", "shell.openExternal", "storage.read", "storage.write", "ui.slot.ability-detail", "ui.slot.workspace-view"]);
  assert.deepEqual(plugin.network.allowedHosts.sort(), ["github.com", "release-assets.githubusercontent.com"]);

  const services = plugin.providers?.services;
  assert.equal(services?.length, 1);
  const service = services[0];
  assert.equal(service.id, "proxy");
  const upstream = readJson(packageFile(directory, "upstream.json"));
  const runtimeLock = readJson(packageFile(directory, "runtime-lock.json"));
  assert.equal(service.runtime.version, `${upstream.core.version}+gemini.${upstream.providerPlugins["gemini-cli"].version}`);
  assert.equal(runtimeLock.version, service.runtime.version);
  assert.equal(service.templates[0].mode, "render");
  assert.ok(service.process.args.includes("${VETTA_SERVICE_CACHE_DIR}/config.yaml"));
  assert.deepEqual(Object.keys(service.runtime.platforms).sort(), [
    "darwin-arm64",
    "darwin-x64",
    "linux-arm64",
    "linux-x64",
    "win32-arm64",
    "win32-x64",
  ]);
  for (const [platform, definition] of Object.entries(service.runtime.platforms)) {
    assert.equal(definition.artifacts.length, 2, platform);
    assert.equal(new Set(definition.artifacts.map((artifact) => artifact.destination)).size, 2, platform);
    assert.equal(runtimeLock.platforms[platform].length, 2, platform);
    for (const [index, artifact] of definition.artifacts.entries()) {
      assert.equal("url" in artifact, false, platform);
      assert.match(artifact.sha256, /^[a-f0-9]{64}$/u, platform);
      assert.ok(["zip", "tar.gz"].includes(artifact.archive), platform);
      const source = runtimeLock.platforms[platform][index];
      assert.equal(source.destination, artifact.destination, platform);
      assert.equal(source.sha256, artifact.sha256, platform);
      assert.match(source.url, /^https:\/\/github\.com\/router-for-me\//u, platform);
      assert.doesNotMatch(source.url, /latest|no-plugin/u, platform);
    }
  }
  assert.deepEqual(service.credentials.map((item) => item.id).sort(), ["api-key", "management-key"]);
  assert.equal(service.health.path, "/v1/models");
  assert.equal(service.health.credentialId, "api-key");

  const template = readFileSync(packageFile(directory, "assets/config.yaml.tpl"), "utf8");
  assert.equal(readFileSync(packageFile(directory, service.templates[0].source), "utf8"), template);
  const federation = readJson(packageFile(directory, plugin.entry));
  assert.equal(federation.name, plugin.moduleFederation.remoteName);
  assert.deepEqual(plugin.styles, ["dist/style.css"]);
  packageFile(directory, "dist/style.css");
  const productionModules = federation.metaData.remoteEntry.path
    ? [packageFile(directory, `${federation.metaData.remoteEntry.path}/${federation.metaData.remoteEntry.name}`)]
    : [];
  for (const asset of federation.exposes.flatMap((entry) => entry.assets.js.sync)) {
    productionModules.push(packageFile(directory, `dist/${asset}`));
  }
  const productionCode = productionModules.map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(productionCode, /["']\/assets\/(?:gemini-cli|codex|claude|antigravity|kimi|xai)-/u);
  const providerIconFiles = Array.from(
    productionCode.matchAll(/new URL\("((?:gemini-cli|codex|claude|antigravity|kimi|xai)-[^"]+\.svg)",\s*import\.meta\.url\)/gu),
    (match) => match[1],
  );
  assert.equal(new Set(providerIconFiles).size, 6);
  for (const iconFile of providerIconFiles) {
    const icon = readFileSync(packageFile(directory, `dist/assets/${iconFile}`), "utf8");
    assert.match(icon, /^<svg[^>]+viewBox="0 0 24 24"/u);
  }
  const iconProvenance = readJson(packageFile(directory, "dist/assets/providers/lobe-icons.json"));
  assert.equal(iconProvenance.package, "@lobehub/icons-static-svg");
  assert.equal(iconProvenance.version, "1.94.0");
  assert.equal(Object.keys(iconProvenance.icons).length, 6);
  assert.match(readFileSync(packageFile(directory, "dist/assets/providers/LOBE-ICONS-LICENSE"), "utf8"), /MIT License/u);
  for (const detail of ["detail.json", "detail.zh.json"]) {
    assert.deepEqual(readJson(packageFile(directory, `dist/assets/${detail}`)), readJson(packageFile(directory, detail)));
  }
  assert.match(template, /host: "127\.0\.0\.1"/u);
  assert.match(template, /allow-remote: false/u);
  assert.match(template, /disable-control-panel: true/u);
  assert.match(template, /plugins:[\s\S]*gemini-cli:/u);
  assert.doesNotMatch(template, /0\.0\.0\.0/u);

  const providerContract = readFileSync(packageFile(directory, "src/provider-contract.ts"), "utf8");
  for (const route of [
    "gemini-cli-auth-url",
    "codex-auth-url",
    "anthropic-auth-url",
    "antigravity-auth-url",
    "kimi-auth-url",
    "xai-auth-url",
    "gemini-api-key",
    "claude-api-key",
    "codex-api-key",
    "xai-api-key",
    "vertex-api-key",
    "openai-compatibility",
  ]) assert.match(providerContract, new RegExp(route, "u"));

  const integration = ["src/index.tsx", "src/setup-slot.tsx", "src/use-proxy-console.ts", "src/workspace-view.tsx", "src/model-selection.ts", "src/quota-probe.ts", "src/proxy-client.ts", "src/runtime-provisioner.ts"].map((path) => readFileSync(packageFile(directory, path), "utf8")).join("\n");
  assert.match(integration, /\/v0\/management\/get-auth-status/u);
  assert.match(integration, /\/v0\/management\/oauth-session/u);
  assert.match(integration, /\/v0\/management\/auth-files/u);
  assert.match(integration, /google-generative-ai/u);
  assert.match(integration, /anthropic-messages/u);
  assert.match(integration, /openai-responses/u);
  assert.match(integration, /openai-completions/u);
  assert.match(integration, /network\.request/u);
  assert.match(integration, /services\.install/u);
  // Models must carry the upstream context window; without it the host silently
  // falls back to 128k and 1M-token models are published eight times too small.
  assert.match(integration, /\/v0\/management\/model-definitions/u);
  assert.match(integration, /contextWindow/u);
  assert.match(integration, /registerWorkspaceView/u);
  // Quota is read through the gateway, which substitutes the token: the plugin
  // must never carry a provider credential itself.
  assert.match(integration, /\/v0\/management\/api-call/u);
  assert.match(integration, /\$TOKEN\$/u);
  // The published set is chosen by the user and must survive a restart, or the
  // service's own sync would put the unticked models back on the next start.
  assert.match(integration, /published-models/u);

  packageFile(directory, plugin.entry);
  packageFile(directory, "upstream.json");
  packageFile(directory, "LICENSE");
});

test("Notion uses the official hosted endpoint with user browser authorization only", () => {
  const ability = bySlug.get("notion");
  assert.equal(ability?.type, "mcp");
  assert.equal(ability.author, "Notion");
  const directory = packageFile(root, ability.source.path);
  const presentation = readJson(packageFile(directory, "ability.json"));
  assert.equal(presentation.icon, "https://www.notion.so/images/favicon.ico");

  const mcp = readJson(packageFile(directory, "mcp.json"));
  assert.deepEqual(mcp.server, {
    type: "http",
    url: "https://mcp.notion.com/mcp",
  });
  assert.deepEqual(mcp.parameters, []);
  assert.equal(mcp.browserAuth, true);
  assert.equal("runtime" in mcp, false);

  for (const detailPath of ["detail.json", "detail.zh.json"]) {
    const text = JSON.stringify(readJson(packageFile(directory, detailPath)));
    assert.match(text, /browser|浏览器/u);
    assert.match(text, /no developer token|无需开发者 Token/u);
    assert.match(text, /workspace|工作区/u);
  }
});

test("Cloudflare is one listed bundle with five independently installable members", () => {
  const bundle = bySlug.get("cloudflare-developer-platform");
  assert.equal(bundle?.type, "bundle");
  assert.deepEqual(bundle.config.members, [
    { type: "skill", slug: "cloudflare", source: { path: "abilities/skills/cloudflare" } },
    { type: "skill", slug: "wrangler", source: { path: "abilities/skills/wrangler" } },
    { type: "skill", slug: "workers-best-practices", source: { path: "abilities/skills/workers-best-practices" } },
    { type: "mcp", slug: "cloudflare-docs", source: { path: "abilities/mcp/cloudflare-docs" } },
    { type: "mcp", slug: "cloudflare-api", source: { path: "abilities/mcp/cloudflare-api" } },
  ]);

  const listed = new Set(catalog.abilities.map((ability) => ability.slug));
  assert.equal(listed.has(bundle.slug), true);
  for (const member of bundle.config.members) {
    assert.equal(listed.has(member.slug), false, member.slug);
    const ability = bySlug.get(member.slug);
    assert.equal(ability.version, "1.0.0");
    assert.equal(ability.configVersion, 1);
    assert.deepEqual(ability.categoryI18n, { zh: "开发", en: "Development" });
  }
});

test("Cloudflare skills retain pinned official sources, licenses and the project-local Wrangler contract", () => {
  const revision = "f96bff754e428838818017f75817f0f9428acd48";
  const licenseSha256 = "49bbe9114e49214df2ccc324cb3ac8d1d1aa1c3a0947f94c286765e86647b32e";
  const sourcePaths = new Map([
    ["cloudflare", "skills/cloudflare"],
    ["wrangler", "skills/wrangler"],
    ["workers-best-practices", "skills/workers-best-practices"],
  ]);
  const officialLogo = readFileSync(packageFile(root, "abilities/bundles/cloudflare-developer-platform/assets/icon.svg"));

  for (const [slug, sourcePath] of sourcePaths) {
    const ability = bySlug.get(slug);
    const directory = packageFile(root, ability.source.path);
    const provenance = readJson(packageFile(directory, "upstream.json"));
    assert.equal(provenance.repository, "https://github.com/cloudflare/skills");
    assert.equal(provenance.revision, revision);
    assert.equal(provenance.sourcePath, sourcePath);
    assert.equal(provenance.license, "Apache-2.0");
    assert.equal(provenance.licenseSha256, licenseSha256);
    const license = readFileSync(packageFile(directory, "LICENSE"));
    assert.equal(createHash("sha256").update(license).digest("hex"), licenseSha256);
    assert.deepEqual(readFileSync(packageFile(directory, "assets/icon.svg")), officialLogo);
  }

  const wrangler = readFileSync(packageFile(root, "abilities/skills/wrangler/SKILL.md"), "utf8");
  assert.match(wrangler, /npm install -D wrangler@latest/u);
  assert.doesNotMatch(wrangler, /npm install -g/u);
});

test("Cloudflare hosted MCP connections separate public documentation from browser-authorized account access", () => {
  const docsDirectory = packageFile(root, bySlug.get("cloudflare-docs").source.path);
  const docs = readJson(packageFile(docsDirectory, "mcp.json"));
  assert.deepEqual(docs.server, {
    type: "http",
    url: "https://docs.mcp.cloudflare.com/mcp",
  });
  assert.deepEqual(docs.parameters, []);
  assert.equal(docs.browserAuth, false);
  assert.equal("runtime" in docs, false);

  const apiDirectory = packageFile(root, bySlug.get("cloudflare-api").source.path);
  const api = readJson(packageFile(apiDirectory, "mcp.json"));
  assert.deepEqual(api.server, {
    type: "http",
    url: "https://mcp.cloudflare.com/mcp",
  });
  assert.deepEqual(api.parameters, []);
  assert.equal(api.browserAuth, true);
  assert.equal("runtime" in api, false);
  assert.equal("autoApprove" in api, false);
  assert.equal("headers" in api.server, false);

  for (const path of ["detail.json", "detail.zh.json"]) {
    const docsText = JSON.stringify(readJson(packageFile(docsDirectory, path)));
    assert.match(docsText, /public|公开/u);
    assert.match(docsText, /does not grant access|不会获得.*账号/u);

    const apiText = JSON.stringify(readJson(packageFile(apiDirectory, path)));
    assert.match(apiText, /browser|浏览器/u);
    assert.match(apiText, /least-privilege|最小权限/u);
    assert.match(apiText, /charges|费用/u);
  }
});

for (const slug of [
  "cloudflare-developer-platform",
  "cloudflare",
  "wrangler",
  "workers-best-practices",
  "cloudflare-docs",
  "cloudflare-api",
]) {
  test(`${slug}: Cloudflare details provide a short Vetta journey in both languages`, () => {
    const ability = bySlug.get(slug);
    const directory = packageFile(root, ability.source.path);
    const presentation = readJson(packageFile(directory, "ability.json"));
    const detail = presentation.detail;
    for (const source of [detail, detail.i18n.zh]) {
      assert.equal(source.format ?? detail.format, "blocks");
      assert.equal(source.fallback, undefined);
      const { blocks } = readJson(packageFile(directory, source.path));
      assert.ok(blocks.some((block) => block.type === "hero"));
      assert.ok(blocks.some((block) => block.type === "showcase"));
      const steps = blocks.find((block) => block.type === "steps");
      assert.ok(steps?.items.length > 0 && steps.items.length <= 3);
      assert.match(JSON.stringify(blocks), /Vetta/u);
    }
  });
}

test("Zhihu research combines its guide with a pinned, credential-parameterized search server", () => {
  const bundle = bySlug.get("zhihu-research");
  assert.equal(bundle?.type, "bundle");
  assert.deepEqual(bundle.config.members, [
    { type: "skill", slug: "zhihu-search", source: { path: "abilities/skills/zhihu-search" } },
    { type: "mcp", slug: "zhihu-search-mcp", source: { path: "abilities/mcp/zhihu-search-mcp" } },
  ]);
  const ability = bySlug.get("zhihu-search-mcp");
  const mcp = readJson(packageFile(root, `${ability.source.path}/mcp.json`));
  assert.deepEqual(mcp.server, {
    type: "stdio",
    command: "uvx",
    args: ["--from", "zhihu-search==2.0.0", "zhihu-search", "serve", "--tools", "compact"],
  });
  assert.deepEqual(mcp.parameters, [{
    key: "ZHIHU_ACCESS_SECRET",
    label: "Zhihu Access Secret",
    required: true,
    secret: true,
    helpUrl: "https://developer.zhihu.com/",
  }]);
  assert.equal(mcp.browserAuth, false);
  assert.equal("runtime" in mcp, false);
});

test("Xiaohongshu uses the HTTP service bridge and declares QR login setup", () => {
  const ability = bySlug.get("xiaohongshu-mcp");
  assert.ok(ability);
  assert.equal(ability.configVersion, 4);
  const mcp = readJson(packageFile(root, `${ability.source.path}/mcp.json`));
  assert.deepEqual(mcp.runtime.service, { kind: "http-mcp", path: "/mcp", readyTimeoutMs: 300000 });
  assert.deepEqual(mcp.server, {
    type: "stdio",
    command: "${VETTA_MCP_EXECUTABLE}",
    args: ["-port=:${VETTA_MCP_PORT}"],
    env: { COOKIES_PATH: "${VETTA_MCP_DATA_DIR}/cookies.json" },
  });
  assert.deepEqual(mcp.setup, {
    kind: "agent-tool",
    tool: "get_login_qrcode",
    completedWhen: { dataFile: "cookies.json" },
  });
});

test("only the Zhihu bundle is independently listed; both members retain bilingual metadata and stable identities", () => {
  const listed = new Set(catalog.abilities.map((ability) => ability.slug));
  assert.equal(listed.has("zhihu-research"), true);
  for (const slug of ["zhihu-search", "zhihu-search-mcp"]) {
    assert.equal(listed.has(slug), false);
    const member = bySlug.get(slug);
    assert.equal(member.version, "2.0.0");
    assert.equal(member.configVersion, 1);
    assert.ok(member.name.trim());
    assert.ok(member.detail.i18n.zh.name.trim());
    assert.deepEqual(member.categoryI18n, { zh: "社交", en: "Social" });
  }
});

test("Zhihu guide pins CLI fallback, references local setup and preserves upstream provenance", () => {
  const ability = bySlug.get("zhihu-search");
  assert.equal(ability?.type, "skill");
  const directory = packageFile(root, ability.source.path);
  const skill = readFileSync(packageFile(directory, "SKILL.md"), "utf8");
  assert.match(skill, /zhihu-search-mcp/u);
  assert.match(skill, /uvx --from zhihu-search==2\.0\.0 zhihu-search search/u);
  assert.doesNotMatch(skill, /uvx (?!--from zhihu-search==2\.0\.0 zhihu-search)/u);
  assert.match(skill, /Never read Vetta.*credentials/u);
  const setup = readFileSync(packageFile(directory, "references/setup.md"), "utf8");
  assert.doesNotMatch(setup, /npx |install-skill|codex mcp|dsh plugin/u);
  assert.match(setup, /not shared with.*CLI/u);
  const license = readFileSync(packageFile(directory, "LICENSE"), "utf8");
  assert.match(license, /Star And Thank Author License/u);
  assert.match(license, /Copyright © 2026 Klarkxy/u);
  const provenance = readJson(packageFile(directory, "upstream.json"));
  assert.equal(provenance.repository, "https://github.com/klarkxy/zhihu-search");
  assert.match(provenance.revision, /^[a-f0-9]{40}$/u);
  for (const path of Object.keys(provenance.files)) packageFile(directory, path);
  assert.ok(dirname(directory).endsWith("skills"));
});

for (const slug of ["zhihu-research", "zhihu-search", "zhihu-search-mcp"]) {
  test(`${slug}: Vetta product details separate the user journey from integration instructions in both languages`, () => {
    const ability = bySlug.get(slug);
    const directory = packageFile(root, ability.source.path);
    const presentation = readJson(packageFile(directory, "ability.json"));
    const detail = presentation.detail;
    for (const source of [detail, detail.i18n.zh]) {
      assert.equal(source.format ?? detail.format, "blocks");
      assert.doesNotMatch(source.path, /README/iu);
      assert.equal(source.fallback, undefined, "Do not silently fall back to the technical README");
      const { blocks } = readJson(packageFile(directory, source.path));
      assert.ok(blocks.some((block) => block.type === "hero"));
      assert.ok(blocks.some((block) => block.type === "showcase"));
      const steps = blocks.find((block) => block.type === "steps");
      assert.ok(steps?.items.length > 0 && steps.items.length <= 3);
      const text = JSON.stringify(blocks);
      assert.match(text, /Vetta/u);
      assert.doesNotMatch(text, /uvx|--from|stdio|ZHIHU_ACCESS_SECRET|PyPI|SHA-256|configVersion/u);
      const links = blocks.filter((block) => block.type === "links").flatMap((block) => block.items);
      assert.ok(links.some((link) => link.href.includes("vetta-official-marketplace") && link.href.includes("README")));
      if (slug !== "zhihu-search") {
        assert.match(text, /\buv\b/u, "Do not hide the current runtime prerequisite");
        assert.match(text, /Access Secret/u, "Name the credential the installation dialog asks for");
        assert.ok(links.some((link) => link.href === "https://developer.zhihu.com/"));
        assert.ok(links.some((link) => link.href === "https://docs.astral.sh/uv/getting-started/installation/"));
      }
    }
  });
}
