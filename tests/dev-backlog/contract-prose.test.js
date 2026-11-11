// Contract tests guard parseable relationships, never a sentence or file count.
// Historical wording and deleted prose-only properties remain available in git.
const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

it("keeps living charter objective IDs unique and disjoint from retired IDs", () => {
  const charter = fs.readFileSync(path.join(ROOT, "spec/charter.md"), "utf8");
  const objectivesSection = charter.split(/^## Objectives\b/m)[1]?.split(/^## /m)[0];
  assert.ok(objectivesSection, "charter must have an Objectives section");

  const living = [...objectivesSection.matchAll(/^- (O\d+)\s+[—-]/gm)].map((match) => match[1]);
  const retiredLine = objectivesSection.split(/\r?\n/).find((line) => /Retired IDs/i.test(line));
  const retired = retiredLine?.match(/O\d+/g) || [];
  assert.ok(living.length > 0, "charter must declare at least one living objective");
  assert.equal(new Set(living).size, living.length, "living objective IDs must be unique");
  assert.equal(new Set(retired).size, retired.length, "retired objective IDs must be unique");
  assert.deepEqual(living.filter((id) => retired.includes(id)), [],
    "a retired objective ID must never be reused as living");
});

it("keeps every living dev-backlog reference reachable without pinning its inventory", () => {
  const skillPath = path.join(ROOT, "skills/dev-backlog/SKILL.md");
  const referencesDir = path.join(ROOT, "skills/dev-backlog/references");
  const skill = fs.readFileSync(skillPath, "utf8");
  const linked = new Set(
    [...skill.matchAll(/references\/([A-Za-z0-9-]+\.md)/g)].map((match) => match[1])
  );
  const living = fs.readdirSync(referencesDir)
    .filter((name) => name.endsWith(".md"));

  assert.ok(living.length > 0, "the skill must have at least one reference contract");
  for (const name of living) {
    assert.ok(linked.has(name), `${name} must be linked from SKILL.md`);
  }
  for (const name of linked) {
    assert.ok(fs.existsSync(path.join(referencesDir, name)),
      `SKILL.md reference must resolve: ${name}`);
  }
});
