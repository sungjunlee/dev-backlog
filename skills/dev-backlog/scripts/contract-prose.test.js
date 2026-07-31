const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const SURFACES = [
  "skills/dev-backlog/SKILL.md",
  "README.md",
  "CLAUDE.md",
  "spec/system-map.md",
  "skills/dev-backlog/references/integration-contract.md",
];

for (const file of SURFACES) {
  it(`${file} states the standalone GitHub authority`, () => {
    const markdown = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(markdown, /GitHub Issues[^\n]*(?:canonical|authority|source of truth)/i);
    assert.match(
      markdown,
      /(?:no required task mirror|no task-file directory required|optional legacy export)/i,
    );
    assert.doesNotMatch(markdown, /local-tracker\.json\s*\(canonical/i);
    assert.doesNotMatch(markdown, /local-tracker\.js\s*->/i);
  });
}

it("records compatibility subtraction in current decisions and release notes", () => {
  const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
  const capabilities = read("spec/capabilities.md");
  const charter = read("spec/charter.md");
  const changelog = read("CHANGELOG.md").split("## [0.9.0]")[0];

  assert.match(capabilities, /Remove the zero-adopter local tracker/);
  assert.match(capabilities, /2026-07-26 local JSON authority/);
  assert.match(charter, /Remove the zero-adopter local tracker/);
  assert.match(changelog, /Required task mirrors/);
  assert.match(changelog, /Zero-adopter local tracker/);
  assert.doesNotMatch(changelog, /task mirrors under `backlog\/tasks\/` remain core/);
});

it("keeps the actor contract GitHub-only while preserving historical ref parsing", () => {
  const markdown = fs.readFileSync(
    path.join(ROOT, "skills/dev-backlog/references/integration-contract.md"),
    "utf8",
  );
  assert.match(markdown, /accepts exactly one runtime authority: `github`/);
  assert.match(markdown, /Historical compatibility only:/);
  assert.match(markdown, /does not\s+make `local` a valid `\.tracker` selection/);
  assert.doesNotMatch(markdown, /Local Plan items use/);
  assert.doesNotMatch(markdown, /"tracker": "local",\s*\n\s*"capability"/);
  assert.doesNotMatch(markdown, /explicitly change backlog\/\.tracker to a tracker/);
});
