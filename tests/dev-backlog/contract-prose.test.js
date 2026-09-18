// Prose tests guard living invariants (who owns task truth; charter structure), never wording.
// Historical phrasing is recorded in git and CHANGELOG; do not pin it here.
const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const SURFACES = [
  "skills/dev-backlog/SKILL.md",
  "README.md",
  "CLAUDE.md",
  "spec/system-map.md",
];
const LIVING_DEV_BACKLOG_REFERENCES = [
  "authority-contract.md",
  "file-format.md",
  "spec-fallback.md",
];

for (const file of SURFACES) {
  it(`${file} states the one declared task authority with GitHub as the default`, () => {
    const markdown = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(markdown, /task authority/i);
    assert.match(markdown, /GitHub Issues?[^\n]*(?:by default|default)|default[^\n]*GitHub Issues?/i);
    assert.doesNotMatch(markdown, /local-tracker\.json\s*\(canonical/i);
    assert.doesNotMatch(markdown, /local-tracker\.js\s*->/i);
  });
}

it("keeps the living charter status-free with retired IDs pinned in git", () => {
  const charter = fs.readFileSync(path.join(ROOT, "spec/charter.md"), "utf8");
  const afterObjectives = charter.split(/^## Objectives\b/m);
  assert.equal(afterObjectives.length, 2, "charter must have one ## Objectives heading");
  const between = afterObjectives[1].split(/^## Decisions\b/m);
  assert.equal(between.length, 2, "charter must have ## Decisions after ## Objectives");
  const objectives = between[0];
  assert.match(charter, /^- O10 — /m);
  assert.doesNotMatch(charter, /^- O\d+ \[(?:validated|active|implemented|deferred)\]/m);
  assert.match(objectives, /Retired IDs \(never reuse\): O3, O5[–-]O9/);
  assert.match(
    objectives,
    /https:\/\/github\.com\/sungjunlee\/dev-backlog\/blob\/4fea158\/spec\/charter\.md/,
  );
});

it("keeps skills/dev-backlog/references/ to three living contracts", () => {
  const dir = path.join(ROOT, "skills/dev-backlog/references");
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".md")).sort();
  assert.deepEqual(files, LIVING_DEV_BACKLOG_REFERENCES);
});

it("keeps remaining reference contracts free of tracker-selection language", () => {
  const dir = path.join(ROOT, "skills/dev-backlog/references");
  for (const name of LIVING_DEV_BACKLOG_REFERENCES) {
    const markdown = fs.readFileSync(path.join(dir, name), "utf8");
    assert.doesNotMatch(markdown, /Local Plan items use/);
    assert.doesNotMatch(markdown, /\.tracker=(?:github|files)/);
    assert.doesNotMatch(markdown, /TRACKER_KEYS/);
    assert.doesNotMatch(markdown, /BACK-N/);
  }
});
