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
  const specHistory = read("docs/spec-history.md");
  const changelog = read("CHANGELOG.md").split("## [0.9.0]")[0];

  assert.match(capabilities, /Remove the zero-adopter local tracker/);
  assert.match(capabilities, /2026-07-26 local JSON authority/);
  assert.match(specHistory, /Remove the zero-adopter local tracker/);
  assert.match(changelog, /Required task mirrors/);
  assert.match(changelog, /Zero-adopter local tracker/);
  assert.doesNotMatch(changelog, /task mirrors under `backlog\/tasks\/` remain core/);
});

it("keeps the living charter status-free with history externalized", () => {
  const charter = fs.readFileSync(path.join(ROOT, "spec/charter.md"), "utf8");
  assert.match(charter, /^- O10 — /m);
  assert.doesNotMatch(charter, /^- O\d+ \[(?:validated|active|implemented|deferred)\]/m);
  assert.match(charter, /docs\/spec-history\.md/);
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

it("records the measured Projects decision without adding a core profile", () => {
  const sync = fs.readFileSync(
    path.join(ROOT, "skills/dev-backlog/references/github-sync.md"),
    "utf8",
  );

  assert.match(sync, /Projects are therefore not an\s+adopted dev-backlog profile/);
  assert.match(sync, /Milestones \+ labels remain the planning default/);
  assert.match(sync, /blob\/v0\.10\.0\/docs\/github-projects-projection-pilot\.md/);
});

it("keeps historical retrieval as a measured disposable shadow", () => {
  const markdown = fs.readFileSync(
    path.join(ROOT, "docs/historical-retrieval-shadow.md"),
    "utf8",
  );

  assert.match(markdown, /The shadow is active/);
  assert.match(markdown, /No compiled report, topic graph, search index/);
  assert.match(markdown, /20\/20 \(100%\)/);
  assert.match(markdown, /37\/41 Issue\/PR pointers/);
  assert.match(markdown, /1 local query \+ 0\.05 amortized external compile/);
  assert.match(markdown, /no decision before 2026-08-28/);
  assert.match(markdown, /project-memory.*human-gated charter amendment/si);
  assert.match(markdown, /outside the\s+repository/);
});
