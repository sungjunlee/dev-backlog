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
