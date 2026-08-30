import assert from "node:assert/strict";
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
