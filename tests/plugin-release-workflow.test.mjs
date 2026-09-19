import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workflow = readFileSync(fileURLToPath(new URL("../.github/workflows/publish-plugin.yml", import.meta.url)), "utf8");
const marketplaceCheck = readFileSync(fileURLToPath(new URL("../.github/workflows/marketplace-check.yml", import.meta.url)), "utf8");

test("plugin publication builds immutable packages and always ends in a reviewed Draft PR", () => {
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /npm test --if-present/u);
  assert.match(workflow, /stage-plugin-release\.py/u);
  assert.match(workflow, /gh release create/u);
  assert.match(workflow, /\.vettapkg/u);
  assert.match(workflow, /gh pr create --draft/u);
  assert.match(workflow, /check-plugin-marketplace-publication\.mjs/u);
  assert.doesNotMatch(workflow, /gh pr merge|--auto|--clobber/u);
  assert.doesNotMatch(workflow, /git push origin (?:"|')?(?:main|marketplace-v3)/u);
});

test("plugin publication can build from the latest target marketplace commit", () => {
  assert.match(workflow, /if \[\[ "\$SOURCE_REF" == "\$BASE_BRANCH" \]\]/u);
  assert.match(workflow, /"\$source_sha" == "\$base_sha"/u);
  assert.doesNotMatch(workflow, /source_ref must be a review branch/u);
  assert.match(workflow, /default: refa\/marketplace-v3/u);
});

test("generated release PR commits can explicitly dispatch the marketplace gate", () => {
  assert.match(marketplaceCheck, /workflow_dispatch:/u);
  assert.match(marketplaceCheck, /base_ref:/u);
  assert.match(workflow, /gh workflow run marketplace-check\.yml/u);
});

test("marketplace checks use valid plugin list expressions", () => {
  assert.doesNotMatch(marketplaceCheck, /:\[\]:\[\]/u);
  assert.match(marketplaceCheck, /flatMap\(x=>x\.type==='plugin'\?\[x\]:x\.type==='bundle'\?/u);
});
